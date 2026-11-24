import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields, maxLen, validDate } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

const GENDERS = new Set(["male", "female"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PatientBody {
  fullName?: string;
  phone?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: string;
  ageYears?: number | string | null;
  address?: string;
  notes?: string;
}

function parsePatient(body: PatientBody) {
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
  if (gender && !GENDERS.has(gender)) throw new HttpError(400, "Gender must be male or female");

  let dateOfBirth = String(body.dateOfBirth ?? "").trim() || undefined;
  if (dateOfBirth) {
    dateOfBirth = validDate(dateOfBirth, "Date of birth");
    if (dateOfBirth > new Date().toISOString().slice(0, 10)) {
      throw new HttpError(400, "Date of birth cannot be in the future");
    }
  }

  let ageYears: number | undefined;
  if (!dateOfBirth && body.ageYears !== undefined && body.ageYears !== null) {
    const raw = String(body.ageYears).trim();
    if (raw) {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 150) {
        throw new HttpError(400, "Age must be between 0 and 150");
      }
      ageYears = Math.round(n);
    }
  }

  const address = String(body.address ?? "").trim() || undefined;
  if (address) maxLen(address, "Address", 200);

  const notes = String(body.notes ?? "").trim() || undefined;
  if (notes) maxLen(notes, "Notes", 2000);

  return { fullName, phone, email, gender, dateOfBirth, ageYears, address, notes };
}

/** List the patient register for the signed-in company. */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("patients", ["admin", "secretary", "manager", "employee"]);
    try {
      const patients = await cx().query(api.patients.listPatients, {
        secret: secret(),
        orgId: session.orgId as never,
        viewerId: session.id as never,
      });
      return ok({ patients });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Register a new patient. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("patients", ["admin", "secretary", "manager"]);
    const body = await readJson<PatientBody>(req);
    requireFields(body as Record<string, unknown>, ["fullName"]);
    const input = parsePatient(body);

    try {
      const res = await cx().mutation(api.patients.createPatient, {
        secret: secret(),
        orgId: session.orgId as never,
        viewerId: session.id as never,
        ...input,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
