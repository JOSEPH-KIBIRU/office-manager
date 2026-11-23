import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields, maxLen, amountInRange, validDate } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

const PAYMENT_METHODS = ["cash", "mpesa", "card", "bank_transfer", "insurance", "other"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

interface NewPatientBody {
  fullName?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
}

interface ConsultationBody {
  patientId?: string;
  newPatient?: NewPatientBody;
  consultationDate?: string;
  procedureName?: string;
  doctorName?: string;
  amount?: number | string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: "paid" | "unpaid";
  notes?: string;
}

function parseMethod(value: unknown): PaymentMethod {
  const method = String(value ?? "").trim() as PaymentMethod;
  if (!PAYMENT_METHODS.includes(method)) throw new HttpError(400, "Choose a valid payment method");
  return method;
}

function parseStatus(value: unknown): "paid" | "unpaid" {
  const status = String(value ?? "").trim();
  if (status !== "paid" && status !== "unpaid") {
    throw new HttpError(400, "Payment status must be paid or unpaid");
  }
  return status;
}

/** List consultations with their patient's name and number. */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("patients", ["admin", "secretary", "manager", "employee"]);
    try {
      const consultations = await cx().query(api.patients.listConsultations, {
        secret: secret(),
        orgId: session.orgId as never,
        viewerId: session.id as never,
      });
      return ok({ consultations });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/**
 * Record a consultation fee. Either pass `patientId` or an inline `newPatient`.
 * The fee posts to the general ledger in the same transaction.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("patients", ["admin", "secretary", "manager"]);
    const body = await readJson<ConsultationBody>(req);
    requireFields(body as Record<string, unknown>, [
      "consultationDate",
      "procedureName",
      "amount",
      "paymentMethod",
      "paymentStatus",
    ]);

    if (!body.patientId && !body.newPatient?.fullName?.trim()) {
      throw new HttpError(400, "Select a patient or register a new one");
    }

    const consultationDate = validDate(body.consultationDate, "Consultation date");
    const procedureName = String(body.procedureName).trim();
    if (!procedureName) throw new HttpError(400, "Please enter the consultation procedure or service");
    maxLen(procedureName, "Procedure", 200);

    const doctorName = String(body.doctorName ?? "").trim() || undefined;
    if (doctorName) maxLen(doctorName, "Doctor", 120);

    const amount = amountInRange(body.amount, "Amount", 1, 100_000_000);
    const method = parseMethod(body.paymentMethod);
    const status = parseStatus(body.paymentStatus);

    const notes = String(body.notes ?? "").trim() || undefined;
    if (notes) maxLen(notes, "Notes", 2000);

    let newPatient:
      | { fullName: string; phone?: string; gender?: string; dateOfBirth?: string }
      | undefined;
    if (!body.patientId) {
      const fullName = String(body.newPatient?.fullName ?? "").trim();
      if (fullName.length < 2) throw new HttpError(400, "Please enter the new patient's full name");
      maxLen(fullName, "Patient name", 120);

      const phone = String(body.newPatient?.phone ?? "").trim() || undefined;
      if (phone) maxLen(phone, "Phone", 30);

      const gender = String(body.newPatient?.gender ?? "").trim().toLowerCase() || undefined;
      if (gender && !["male", "female"].includes(gender)) {
        throw new HttpError(400, "Gender must be male or female");
      }

      let dateOfBirth = String(body.newPatient?.dateOfBirth ?? "").trim() || undefined;
      if (dateOfBirth) {
        dateOfBirth = validDate(dateOfBirth, "Date of birth");
        if (dateOfBirth > new Date().toISOString().slice(0, 10)) {
          throw new HttpError(400, "Date of birth cannot be in the future");
        }
      }
      newPatient = { fullName, phone, gender, dateOfBirth };
    }

    try {
      const res = await cx().mutation(api.patients.createConsultation, {
        secret: secret(),
        orgId: session.orgId as never,
        viewerId: session.id as never,
        patientId: (body.patientId ?? undefined) as never,
        newPatient,
        consultationDate,
        procedureName,
        doctorName,
        amount,
        paymentMethod: method,
        paymentStatus: status,
        notes,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
