"use client";

import { useMemo, useState } from "react";
import { Modal, Alert } from "@/components/ui";
import { useToast } from "@/components/toast";
import { formatKes } from "@/lib/format";
import type {
  ImportIssue,
  ParsedConsultation,
  ParsedPatient,
  PatientImportMode,
} from "@/lib/patientImport";

interface PreviewResponse {
  mode: PatientImportMode;
  totalRows: number;
  patientCount: number;
  consultationCount: number;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  samplePatients: ParsedPatient[];
  sampleConsultations: ParsedConsultation[];
}

interface ImportResult {
  patientsCreated: number;
  patientsSkipped: number;
  patientsFailed: number;
  visitsCreated: number;
  visitsFailed: number;
  errors: ImportIssue[];
}

const MODE_LABELS: Record<PatientImportMode, string> = {
  patients: "Patients only",
  consultations: "Consultations only",
  combined: "Patients + consultations",
};

const MODE_HELP: Record<PatientImportMode, string> = {
  patients: "One row per patient. Existing patients are matched by patient number, phone or full name.",
  consultations:
    "One row per visit. The patient must already exist — match by patient number, phone or full name.",
  combined:
    "One row per visit with the patient's details. New patients are created and matched automatically.",
};

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Import failed";
}

export default function PatientsImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<PatientImportMode>("patients");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validRows = useMemo(
    () => (preview ? preview.patientCount + preview.consultationCount : 0),
    [preview]
  );
  const importLabel = useMemo(() => {
    if (!preview) return "Import";
    if (mode === "patients") return `Import ${preview.patientCount} patient(s)`;
    if (mode === "consultations") return `Import ${preview.consultationCount} visit(s)`;
    return `Import ${preview.patientCount} patient(s) + ${preview.consultationCount} visit(s)`;
  }, [preview, mode]);

  async function callImport(
    action: string,
    extra: Record<string, string> = {},
    overrideMode?: PatientImportMode
  ) {
    if (!file) throw new Error("Choose an Excel or CSV file first.");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mode", overrideMode ?? mode);
    fd.append("action", action);
    for (const [k, v] of Object.entries(extra)) fd.append(k, v);

    const res = await fetch("/api/patients/import", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || "Import request failed");
    return data as Record<string, unknown>;
  }

  async function previewFile(f: File, overrideMode?: PatientImportMode) {
    setFile(f);
    setPreview(null);
    setResult(null);
    setError(null);
    setBusy(true);
    setProgress("Reading the file…");
    try {
      const data = (await callImport("preview", {}, overrideMode)) as unknown as PreviewResponse;
      setPreview(data);
      toast.success(
        `${data.patientCount} patient(s) and ${data.consultationCount} visit(s) detected. Review then import.`
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  async function runImport() {
    if (!file || !preview) return;
    setBusy(true);
    setError(null);
    try {
      let patientsCreated = 0;
      let patientsSkipped = 0;
      let patientsFailed = 0;
      const errors: ImportIssue[] = [...(preview.errors ?? [])];

      if (mode !== "consultations") {
        setProgress("Importing patients…");
        const res = (await callImport("commit-patients")) as {
          created?: number;
          skipped?: number;
          failed?: number;
          errors?: ImportIssue[];
        };
        patientsCreated = res.created ?? 0;
        patientsSkipped = res.skipped ?? 0;
        patientsFailed = res.failed ?? 0;
        errors.push(...(res.errors ?? []));
      }

      let visitsCreated = 0;
      let visitsFailed = 0;

      if (mode !== "patients") {
        const total = preview.consultationCount;
        let offset = 0;
        let done = total === 0;
        while (!done) {
          const end = Math.min(offset + 50, total);
          setProgress(`Importing visits ${offset + 1}–${end} of ${total}…`);
          const res = (await callImport("commit-consultations", {
            offset: String(offset),
            limit: "50",
          })) as {
            created?: number;
            failed?: number;
            errors?: ImportIssue[];
            nextOffset?: number;
            done?: boolean;
          };
          visitsCreated += res.created ?? 0;
          visitsFailed += res.failed ?? 0;
          errors.push(...(res.errors ?? []));
          const next = res.nextOffset ?? end;
          if (next <= offset) break; // safety: never loop forever
          offset = next;
          done = Boolean(res.done) || offset >= total;
        }
      }

      setResult({
        patientsCreated,
        patientsSkipped,
        patientsFailed,
        visitsCreated,
        visitsFailed,
        errors,
      });
      toast.success(
        `Import finished: ${patientsCreated} patient(s), ${visitsCreated} visit(s) imported.`
      );
      onImported();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <Modal title="Import from Excel" size="xl" onClose={onClose}>
      <div className="space-y-5">
        {!result && (
          <>
            <div>
              <span className="label">What are you importing?</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(Object.keys(MODE_LABELS) as PatientImportMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setPreview(null);
                      setResult(null);
                      setError(null);
                      if (file) void previewFile(file, m);
                    }}
                    className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                      mode === m
                        ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <span className="block font-semibold">{MODE_LABELS[m]}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                      {MODE_HELP[m]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="block min-w-[16rem] flex-1">
                <span className="label">Excel or CSV file</span>
                <input
                  type="file"
                  accept=".xlsx,.xlsm,.csv,.tsv,.txt"
                  className="input"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void previewFile(f);
                  }}
                />
              </label>
              <a
                href={`/api/patients/import/template?mode=${mode}`}
                className="btn-secondary"
                download
              >
                Download template
              </a>
            </div>

            {busy && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
                {progress || "Working…"}
              </div>
            )}

            {error && <Alert kind="error">{error}</Alert>}

            {preview && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rows</p>
                    <p className="mt-1 text-xl font-bold text-slate-800">{preview.totalRows}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Patients</p>
                    <p className="mt-1 text-xl font-bold text-slate-800">{preview.patientCount}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Visits</p>
                    <p className="mt-1 text-xl font-bold text-slate-800">{preview.consultationCount}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Errors</p>
                    <p className={`mt-1 text-xl font-bold ${preview.errors.length ? "text-red-600" : "text-emerald-600"}`}>
                      {preview.errors.length}
                    </p>
                  </div>
                </div>

                {preview.errors.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="text-sm font-semibold text-red-800">Rows that cannot be imported</p>
                    <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-red-700">
                      {preview.errors.slice(0, 30).map((e, i) => (
                        <li key={i}>
                          <strong>Row {e.row}:</strong> {e.message}
                        </li>
                      ))}
                    </ul>
                    {preview.errors.length > 30 && (
                      <p className="mt-2 text-xs text-red-600">…and {preview.errors.length - 30} more.</p>
                    )}
                  </div>
                )}

                {preview.warnings.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-800">Warnings</p>
                    <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto text-xs text-amber-700">
                      {preview.warnings.slice(0, 20).map((w, i) => (
                        <li key={i}>
                          <strong>Row {w.row}:</strong> {w.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {preview.samplePatients.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="table-base min-w-[640px]">
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>Patient no.</th>
                          <th>Name</th>
                          <th>Phone</th>
                          <th>Gender</th>
                          <th>Date of birth</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.samplePatients.map((p) => (
                          <tr key={p.key}>
                            <td className="text-slate-400">{p.row}</td>
                            <td className="font-mono text-xs">{p.patientNumber || "auto"}</td>
                            <td className="font-medium text-slate-800">{p.fullName}</td>
                            <td className="text-slate-600">{p.phone || "—"}</td>
                            <td className="text-slate-600">{p.gender || "—"}</td>
                            <td className="text-slate-600">{p.dateOfBirth || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {preview.sampleConsultations.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="table-base min-w-[720px]">
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>Patient</th>
                          <th>Date</th>
                          <th>Procedure</th>
                          <th className="text-right">Amount</th>
                          <th>Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.sampleConsultations.map((c) => (
                          <tr key={c.key}>
                            <td className="text-slate-400">{c.row}</td>
                            <td className="text-slate-700">
                              {c.patientNumber || c.patientName || c.patientPhone || "—"}
                            </td>
                            <td className="whitespace-nowrap text-slate-600">{c.consultationDate}</td>
                            <td className="font-medium text-slate-800">{c.procedureName}</td>
                            <td className="text-right font-semibold text-slate-800">{formatKes(c.amount)}</td>
                            <td className="text-slate-600">
                              {c.paymentStatus} · {c.paymentMethod}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    {preview.warnings.length > 0
                      ? `${preview.warnings.length} warning(s) will be ignored and the row still imported.`
                      : "No warnings."}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={runImport}
                      disabled={busy || validRows === 0}
                    >
                      {busy ? "Importing…" : importLabel}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {result && (
          <div className="space-y-4">
            <Alert kind={result.errors.length ? "error" : "success"}>
              Import finished. Patients created: <strong>{result.patientsCreated}</strong>, skipped:{" "}
              <strong>{result.patientsSkipped}</strong>, failed: <strong>{result.patientsFailed}</strong>.
              Visits created: <strong>{result.visitsCreated}</strong>, failed:{" "}
              <strong>{result.visitsFailed}</strong>.
            </Alert>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-semibold text-red-800">Rows with errors</p>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-red-700">
                  {result.errors.slice(0, 50).map((e, i) => (
                    <li key={i}>
                      <strong>Row {e.row}:</strong> {e.message}
                    </li>
                  ))}
                </ul>
                {result.errors.length > 50 && (
                  <p className="mt-2 text-xs text-red-600">…and {result.errors.length - 50} more.</p>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <button type="button" className="btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
