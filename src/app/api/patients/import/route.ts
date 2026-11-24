import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { allowDistributed } from "@/lib/distributedRateLimit";
import { parseDelimited } from "@/lib/bankImport";
import { xlsxToRows } from "@/lib/bankXlsx";
import { parsePatientImport, type PatientImportMode } from "@/lib/patientImport";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const PATIENT_CHUNK = 100;
const CONSULTATION_CHUNK = 25;

function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/^Uncaught Error: /, "").split("\n")[0].slice(0, 300);
}

async function readRows(file: File): Promise<string[][]> {
  const name = (file.name || "").toLowerCase();
  const ext = name.split(".").pop() || "";
  const buf = new Uint8Array(await file.arrayBuffer());

  if (ext === "xlsx" || ext === "xlsm") return xlsxToRows(buf);
  if (ext === "xls") {
    throw new HttpError(415, "Legacy .xls files are not supported. Save as .xlsx or CSV and try again.");
  }
  if (ext === "csv" || ext === "tsv" || ext === "txt") {
    return parseDelimited(new TextDecoder().decode(buf));
  }
  const text = new TextDecoder().decode(buf);
  if (text.includes("\u0000")) {
    throw new HttpError(415, "Unsupported file type. Use .xlsx or CSV.");
  }
  return parseDelimited(text);
}

function parseMode(value: unknown): PatientImportMode {
  const mode = String(value ?? "patients");
  if (mode !== "patients" && mode !== "consultations" && mode !== "combined") {
    throw new HttpError(400, "Import type must be patients, consultations or combined");
  }
  return mode;
}

function digits(value?: string): string {
  return String(value ?? "").replace(/\D/g, "");
}

function nameKey(value?: string): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * POST /api/patients/import
 * multipart: file, mode, action
 *   action=preview              → parse and return a review summary
 *   action=commit-patients      → create the unique patients
 *   action=commit-consultations → create one slice of consultations
 *
 * Consultation commits are sliced (offset/limit) so large Excel files do not
 * exceed serverless request limits. The file is re-parsed for each slice.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("patients", ["admin", "secretary", "manager"]);

    const gate = await allowDistributed(
      `patientimport:org:${session.orgId}:user:${session.id}`,
      1000,
      15 * 60_000
    );
    if (!gate.allowed) {
      throw new HttpError(429, "Too many import requests. Please wait a few minutes and try again.");
    }

    const cl = Number(req.headers.get("content-length") || 0);
    if (cl && cl > MAX_SIZE + 1024 * 1024) throw new HttpError(413, "File is too large (max 20MB).");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "No file provided.");
    if (file.size > MAX_SIZE) throw new HttpError(413, "File exceeds the 20MB limit.");

    const mode = parseMode(form.get("mode"));
    const action = String(form.get("action") ?? "preview");
    const offset = Math.max(0, Number(form.get("offset") ?? 0) || 0);
    const limit = Math.min(100, Math.max(1, Number(form.get("limit") ?? 50) || 50));

    let rows: string[][];
    try {
      rows = await readRows(file);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      console.error("[patients/import] parse failed:", e);
      throw new HttpError(400, "Could not read that file. Use an .xlsx or CSV file.");
    }

    const parsed = parsePatientImport(rows, mode);
    if (parsed.totalRows === 0) {
      throw new HttpError(422, "No data rows found. Check that the first row contains column headings.");
    }

    if (action === "preview") {
      return ok({
        mode,
        totalRows: parsed.totalRows,
        patientCount: parsed.patients.length,
        consultationCount: parsed.consultations.length,
        errors: parsed.errors,
        warnings: parsed.warnings,
        samplePatients: parsed.patients.slice(0, 10),
        sampleConsultations: parsed.consultations.slice(0, 10),
      });
    }

    if (action === "commit-patients") {
      if (mode === "consultations") {
        return ok({ created: 0, skipped: 0, failed: 0, errors: [], warnings: parsed.warnings });
      }

      const results: Array<{ importKey: string; status: string; message?: string }> = [];

      async function createPatientBatch(batch: typeof parsed.patients) {
        if (batch.length === 0) return;
        try {
          const res = await cx().mutation(api.patients.bulkCreatePatients, {
            secret: secret(),
            orgId: session.orgId as never,
            viewerId: session.id as never,
            rows: batch.map((p) => ({
              importKey: p.key,
              patientNumber: p.patientNumber,
              fullName: p.fullName,
              phone: p.phone,
              email: p.email,
              gender: p.gender,
              dateOfBirth: p.dateOfBirth,
              ageYears: p.ageYears,
              address: p.address,
              notes: p.notes,
            })),
          });
          results.push(...(res.results as Array<{ importKey: string; status: string; message?: string }>));
        } catch (e) {
          // Retry one-by-one so a single bad row doesn't block the whole batch.
          for (const p of batch) {
            try {
              const res = await cx().mutation(api.patients.bulkCreatePatients, {
                secret: secret(),
                orgId: session.orgId as never,
                viewerId: session.id as never,
                rows: [
                  {
                    importKey: p.key,
                    patientNumber: p.patientNumber,
                    fullName: p.fullName,
                    phone: p.phone,
                    email: p.email,
                    gender: p.gender,
                    dateOfBirth: p.dateOfBirth,
                    ageYears: p.ageYears,
                    address: p.address,
                    notes: p.notes,
                  },
                ],
              });
              results.push(...(res.results as Array<{ importKey: string; status: string; message?: string }>));
            } catch (rowError) {
              results.push({ importKey: p.key, status: "error", message: errorText(rowError) });
            }
          }
        }
      }

      for (let i = 0; i < parsed.patients.length; i += PATIENT_CHUNK) {
        await createPatientBatch(parsed.patients.slice(i, i + PATIENT_CHUNK));
      }

      return ok({
        created: results.filter((r) => r.status === "created").length,
        skipped: results.filter((r) => r.status === "skipped").length,
        failed: results.filter((r) => r.status === "error").length,
        errors: results.filter((r) => r.status === "error"),
        warnings: parsed.warnings,
      });
    }

    if (action === "commit-consultations") {
      if (mode === "patients") {
        return ok({ created: 0, failed: 0, errors: [], warnings: parsed.warnings, nextOffset: offset, done: true });
      }

      const total = parsed.consultations.length;
      const slice = parsed.consultations.slice(offset, offset + limit);
      const nextOffset = offset + slice.length;
      const done = nextOffset >= total;

      if (slice.length === 0) {
        return ok({ created: 0, failed: 0, errors: [], warnings: parsed.warnings, nextOffset, done: true });
      }

      // Resolve every patient reference against the current register.
      type PatientRef = {
        id: string;
        patientNumber: string;
        fullName: string;
        phone: string | null;
      };
      let patients: PatientRef[];
      try {
        patients = (await cx().query(api.patients.listPatients, {
          secret: secret(),
          orgId: session.orgId as never,
          viewerId: session.id as never,
        })) as PatientRef[];
      } catch (e) {
        return mapConvexError(e);
      }

      const byNumber = new Map(patients.map((p) => [p.patientNumber.toUpperCase(), p] as const));
      const byPhone = new Map(
        patients.filter((p) => p.phone).map((p) => [digits(p.phone ?? ""), p] as const)
      );
      const byName = new Map(patients.map((p) => [nameKey(p.fullName), p] as const));

      const resolved: Array<{
        importKey: string;
        row: number;
        patientId: string;
        consultationDate: string;
        procedureName: string;
        doctorName?: string;
        amount: number;
        paymentMethod: string;
        paymentStatus: "paid" | "unpaid";
        notes?: string;
      }> = [];
      const errors: Array<{ row: number; message: string }> = [];

      for (const c of slice) {
        const patient =
          (c.patientNumber ? byNumber.get(c.patientNumber.trim().toUpperCase()) : undefined) ||
          (c.patientPhone ? byPhone.get(digits(c.patientPhone)) : undefined) ||
          (c.patientName ? byName.get(nameKey(c.patientName)) : undefined);
        if (!patient) {
          errors.push({
            row: c.row,
            message: "Patient not found. Import the patients first, or check the patient number / phone / name.",
          });
          continue;
        }
        resolved.push({
          importKey: c.key,
          row: c.row,
          patientId: patient.id,
          consultationDate: c.consultationDate,
          procedureName: c.procedureName,
          doctorName: c.doctorName,
          amount: c.amount,
          paymentMethod: c.paymentMethod,
          paymentStatus: c.paymentStatus,
          notes: c.notes,
        });
      }

      let created = 0;
      let failed = errors.length;

      async function createConsultationBatch(batch: typeof resolved) {
        if (batch.length === 0) return;
        try {
          const res = await cx().mutation(api.patients.bulkCreateConsultations, {
            secret: secret(),
            orgId: session.orgId as never,
            viewerId: session.id as never,
            rows: batch.map((r) => ({
              importKey: r.importKey,
              patientId: r.patientId as never,
              consultationDate: r.consultationDate,
              procedureName: r.procedureName,
              doctorName: r.doctorName,
              amount: r.amount,
              paymentMethod: r.paymentMethod as never,
              paymentStatus: r.paymentStatus,
              notes: r.notes,
            })),
          });
          created += res.created;
          failed += res.failed;
          for (const r of res.results as Array<{ importKey: string; status: string; message?: string }>) {
            if (r.status === "error") {
              const row = batch.find((b) => b.importKey === r.importKey)?.row ?? 0;
              errors.push({ row, message: r.message ?? "Import failed" });
            }
          }
        } catch (e) {
          // Retry one-by-one to isolate the failing visit.
          for (const r of batch) {
            try {
              const res = await cx().mutation(api.patients.bulkCreateConsultations, {
                secret: secret(),
                orgId: session.orgId as never,
                viewerId: session.id as never,
                rows: [
                  {
                    importKey: r.importKey,
                    patientId: r.patientId as never,
                    consultationDate: r.consultationDate,
                    procedureName: r.procedureName,
                    doctorName: r.doctorName,
                    amount: r.amount,
                    paymentMethod: r.paymentMethod as never,
                    paymentStatus: r.paymentStatus,
                    notes: r.notes,
                  },
                ],
              });
              created += res.created;
              failed += res.failed;
            } catch (rowError) {
              failed += 1;
              errors.push({ row: r.row, message: errorText(rowError) });
            }
          }
        }
      }

      for (let i = 0; i < resolved.length; i += CONSULTATION_CHUNK) {
        await createConsultationBatch(resolved.slice(i, i + CONSULTATION_CHUNK));
      }

      return ok({
        created,
        failed,
        errors,
        warnings: parsed.warnings,
        nextOffset,
        done,
        total,
      });
    }

    throw new HttpError(400, "Unknown import action");
  });
}
