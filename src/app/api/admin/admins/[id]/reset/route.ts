import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { generateTempPassword } from "@/lib/passwords";
import { sendSMS } from "@/lib/notify";

/**
 * Superadmin: reset a company admin's password to a new temporary password.
 * The password is returned so it can be copied, and optionally texted to the
 * admin's registered phone number.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{ sendSms?: boolean }>(req).catch(() => ({}) as { sendSms?: boolean });

    const tempPassword = generateTempPassword();
    let target;
    try {
      target = await cx().mutation(api.superadmin.resetAdminPassword, {
        secret: secret(),
        superAdminId: session.id as never,
        userId: id as never,
        passwordHash: bcrypt.hashSync(tempPassword, 10),
      });
    } catch (e) {
      return mapConvexError(e);
    }

    let smsSent = false;
    let smsError: string | null = null;
    if (body.sendSms) {
      if (!target.phone) {
        smsError = "No phone number on file for this admin.";
      } else {
        try {
          smsSent = await sendSMS(
            target.phone,
            `Office Manager: your admin password was reset. Login: ${target.email} · Temporary password: ${tempPassword}. You must change it after logging in.`
          );
          if (!smsSent) smsError = "SMS could not be delivered — copy the password and share it manually.";
        } catch {
          smsError = "SMS failed — copy the password and share it manually.";
        }
      }
    }

    const masked = target.phone ? `${target.phone.slice(0, 4)}***${target.phone.slice(-3)}` : null;
    return ok({ tempPassword, smsSent, smsError, name: target.name, email: target.email, phoneMasked: masked });
  });
}
