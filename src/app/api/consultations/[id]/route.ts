import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, maxLen, amountInRange, validDate } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

const PAYMENT_METHODS = ["cash", "mpesa", "card", "bank_transfer", "insurance", "other"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

interface ConsultationBody {
  consultationDate?: string;
  procedureName?: string;
  doctorName?: string;
  amount?: number | string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: "paid" | "unpaid";
  notes?: string;
}

/** Update a consultation; the old ledger entry is reversed and re-posted. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("patients", ["admin", "secretary", "manager"]);
    const { id } = await ctx.params;
    const body = await readJson<ConsultationBody>(req);

    let consultationDate: string | undefined;
    if (body.consultationDate) consultationDate = validDate(body.consultationDate, "Consultation date");

    let procedureName: string | undefined;
    if (body.procedureName !== undefined) {
      procedureName = String(body.procedureName).trim();
      if (!procedureName) throw new HttpError(400, "Please enter the consultation procedure or service");
      maxLen(procedureName, "Procedure", 200);
    }

    let doctorName: string | undefined;
    if (body.doctorName !== undefined) {
      doctorName = String(body.doctorName).trim();
      maxLen(doctorName, "Doctor", 120);
    }

    let amount: number | undefined;
    if (body.amount !== undefined && body.amount !== "") {
      amount = amountInRange(body.amount, "Amount", 1, 100_000_000);
    }

    let paymentMethod: PaymentMethod | undefined;
    if (body.paymentMethod !== undefined) {
      const method = String(body.paymentMethod).trim() as PaymentMethod;
      if (!PAYMENT_METHODS.includes(method)) throw new HttpError(400, "Choose a valid payment method");
      paymentMethod = method;
    }

    let paymentStatus: "paid" | "unpaid" | undefined;
    if (body.paymentStatus !== undefined) {
      const status = String(body.paymentStatus).trim();
      if (status !== "paid" && status !== "unpaid") {
        throw new HttpError(400, "Payment status must be paid or unpaid");
      }
      paymentStatus = status;
    }

    let notes: string | undefined;
    if (body.notes !== undefined) {
      notes = String(body.notes).trim();
      maxLen(notes, "Notes", 2000);
    }

    try {
      const res = await cx().mutation(api.patients.updateConsultation, {
        secret: secret(),
        orgId: session.orgId as never,
        viewerId: session.id as never,
        id: id as never,
        consultationDate,
        procedureName,
        doctorName,
        amount,
        paymentMethod,
        paymentStatus,
        notes,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Delete a consultation and reverse its accounting entry. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("patients", ["admin", "secretary"]);
    const { id } = await ctx.params;

    try {
      const res = await cx().mutation(api.patients.deleteConsultation, {
        secret: secret(),
        orgId: session.orgId as never,
        viewerId: session.id as never,
        id: id as never,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
