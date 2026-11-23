import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, maxLen, validDate } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

const GENDERS = new Set(["male", "female", "other"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PatientBody {
  fullName?: string;
  phone?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  notes?: string;
}

/** Update a patient's details. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("patients", ["admin", "secretary", "manager"]);
    const { id } = await ctx.params;
    const body = await readJson<PatientBody>(req);

    const fullName = String(body.fullName ?? "").trim();
    if (fullName.length < 2) throw new HttpError(400, "Please enter the patient's full name");
    maxLen(fullName, "Patient name", 120);

    const phone = String(body.phone ?? "").trim() || undefined;
    if (phone) maxLen(phone, "Phone", 30);

    const email = String(body.email ?? "").trim() || undefined;
    if (email) {
      maxLen(email, "Email", 120);
      if (!EMAIL_RE.test(email)) throw new HttpError(400, "Please enter a valid email address");
    }

    const gender = String(body.gender ?? "").trim().toLowerCase() || undefined;
    if (gender && !GENDERS.has(gender)) throw new HttpError(400, "Gender must be male, female or other");

    let dateOfBirth = String(body.dateOfBirth ?? "").trim() || undefined;
    if (dateOfBirth) {
      dateOfBirth = validDate(dateOfBirth, "Date of birth");
      if (dateOfBirth > new Date().toISOString().slice(0, 10)) {
        throw new HttpError(400, "Date of birth cannot be in the future");
      }
    }

    const address = String(body.address ?? "").trim() || undefined;
    if (address) maxLen(address, "Address", 200);

    const notes = String(body.notes ?? "").trim() || undefined;
    if (notes) maxLen(notes, "Notes", 2000);

    try {
      const res = await cx().mutation(api.patients.updatePatient, {
        secret: secret(),
        orgId: session.orgId as never,
        viewerId: session.id as never,
        id: id as never,
        fullName,
        phone,
        email,
        gender,
        dateOfBirth,
        address,
        notes,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Delete a patient, their consultations and the linked accounting entries. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("patients", ["admin", "secretary"]);
    const { id } = await ctx.params;

    try {
      const res = await cx().mutation(api.patients.deletePatient, {
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
