import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/** Verify the SMS code and set a new password. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson<{ email: string; code: string; newPassword: string }>(req);
    requireFields(body, ["email", "code", "newPassword"]);

    const email = String(body.email).toLowerCase().trim();
    const code = String(body.code).trim();
    const newPassword = String(body.newPassword);

    if (newPassword.length < 8) throw new HttpError(400, "New password must be at least 8 characters");
    if (!/^\d{6}$/.test(code)) throw new HttpError(400, "Enter the 6-digit code from the SMS");

    if (!rateLimit({ key: `reset:ip:${clientIp(req)}`, limit: 12, windowMs: 15 * 60_000 })) {
      throw new HttpError(429, "Too many attempts. Please try again later.");
    }

    const user = await cx().query(api.auth.getUserByEmail, { secret: secret(), email });
    if (!user || !user.active) throw new HttpError(400, "Incorrect email or code");

    const reset = await cx().query(api.passwordReset.getActiveReset, {
      secret: secret(),
      userId: user._id as never,
    });
    if (!reset) throw new HttpError(400, "This reset code has expired. Please request a new one.");
    if (reset.attempts >= 5) throw new HttpError(400, "Too many incorrect attempts. Please request a new code.");

    if (!bcrypt.compareSync(code, reset.codeHash)) {
      try {
        await cx().mutation(api.passwordReset.registerFailedAttempt, { secret: secret(), id: reset.id as never });
      } catch {
        /* ignore */
      }
      throw new HttpError(400, "Incorrect code");
    }

    try {
      await cx().mutation(api.passwordReset.applyReset, {
        secret: secret(),
        orgId: user.orgId as never,
        resetId: reset.id as never,
        userId: user._id as never,
        newPasswordHash: bcrypt.hashSync(newPassword, 10),
      });
    } catch (e) {
      return mapConvexError(e);
    }

    return ok({ ok: true });
  });
}
