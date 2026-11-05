import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { generateTempPassword } from "@/lib/passwords";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";
import { PHONE_RE } from "@/lib/validation";
import { sendNewUserCredentials } from "@/lib/notify";

/** Platform team: list superadmins (any superadmin) / add one (owner only). */
export async function GET() {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    try {
      const data = await cx().query(api.superadmin.listPlatformAdmins, {
        secret: secret(),
        superAdminId: session.id as never,
      });
      return ok(data);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const body = await readJson<{ name: string; email: string; phone: string }>(req);
    requireFields(body, ["name", "email", "phone"]);

    const name = String(body.name).trim();
    const email = String(body.email).toLowerCase().trim();
    const phone = String(body.phone).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Invalid email address");
    if (!PHONE_RE.test(phone)) throw new HttpError(400, "Invalid phone number");

    const { isOwner } = (await cx().query(api.superadmin.isPlatformOwner, {
      secret: secret(),
      superAdminId: session.id as never,
    })) as { isOwner: boolean };
    if (!isOwner) throw new HttpError(403, "Only the platform owner can add superadmins");

    const tempPassword = generateTempPassword();
    try {
      const result = await cx().mutation(api.superadmin.createPlatformAdmin, {
        secret: secret(),
        superAdminId: session.id as never,
        name,
        email,
        phone,
        passwordHash: bcrypt.hashSync(tempPassword, 10),
      });
      await recordAudit(session, {
        action: "platform.superadmin.create",
        module: "platform",
        summary: `Added superadmin ${email}`,
        targetType: "user",
        targetId: String(result.id),
      });
      const delivery = await sendNewUserCredentials({ name, email, phone }, tempPassword);
      return ok({ ...result, tempPassword, delivery });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
