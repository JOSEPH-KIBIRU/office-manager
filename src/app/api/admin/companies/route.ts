import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { generateTempPassword } from "@/lib/passwords";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export async function GET() {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    let orgs;
    try {
      orgs = await cx().query(api.superadmin.listAllOrganizations, {
        secret: secret(),
        superAdminId: session.id as never,
      });
    } catch (e) {
      return mapConvexError(e);
    }
    return ok({ orgs });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const body = await readJson<{
      name: string;
      adminName: string;
      adminEmail: string;
      workingDays?: number[];
      customRoles?: string[];
    }>(req);
    requireFields(body, ["name", "adminName", "adminEmail"]);

    const name = String(body.name).trim();
    const email = String(body.adminEmail).toLowerCase().trim();
    if (!name) throw new HttpError(400, "Company name is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Invalid admin email");

    const tempPassword = generateTempPassword();

    try {
      const result = await cx().mutation(api.superadmin.createCompany, {
        secret: secret(),
        superAdminId: session.id as never,
        name,
        adminName: String(body.adminName).trim(),
        adminEmail: email,
        adminPasswordHash: bcrypt.hashSync(tempPassword, 10),
        workingDays: Array.isArray(body.workingDays)
          ? body.workingDays.map(Number).filter((d) => d >= 0 && d <= 6)
          : undefined,
        customRoles: Array.isArray(body.customRoles)
          ? body.customRoles.map((r) => String(r).trim()).filter(Boolean).slice(0, 20)
          : undefined,
      });
      await recordAudit(
        session,
        { action: "company.create", module: "platform", summary: `Created company ${name}` },
        null,
        result.orgId
      );
      return ok({ ...result, tempPassword });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
