import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { handle, ok, fail, readJson, requireFields } from "@/lib/api";
import { cx, secret, api } from "@/lib/convex";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { sendSMS } from "@/lib/notify";

const CODE_TTL_MS = 10 * 60_000;

/**
 * Request a password-reset code. The code is delivered by SMS only (never
 * email). Always returns success so the endpoint cannot be used to discover
 * which email addresses exist.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson<{ email: string }>(req);
    requireFields(body, ["email"]);
    const email = String(body.email).toLowerCase().trim();
    const ip = clientIp(req);

    // Cheap per-instance guard first…
    if (!rateLimit({ key: `forgot:ip:${ip}`, limit: 10, windowMs: 15 * 60_000 })) {
      return fail(429, "Too many requests. Please wait a few minutes and try again.");
    }

    // …then a distributed (Convex-backed) guard so the limit actually holds
    // across all serverless instances. Fails open so a backend blip can never
    // block password resets.
    let allowed = true;
    let retryAfterMs = 0;
    try {
      const acct = await cx().mutation(api.rateLimit.hit, {
        secret: secret(),
        key: `forgot:acct:${email}`,
        limit: 3,
        windowMs: 15 * 60_000,
      });
      if (!acct.allowed) {
        allowed = false;
        retryAfterMs = acct.retryAfterMs;
      }
      const ipHit = await cx().mutation(api.rateLimit.hit, {
        secret: secret(),
        key: `forgot:ip:${ip}`,
        limit: 15,
        windowMs: 15 * 60_000,
      });
      if (!ipHit.allowed && allowed) {
        allowed = false;
        retryAfterMs = ipHit.retryAfterMs;
      }
    } catch (e) {
      console.error("[forgot-password] rate-limit check failed:", e);
    }

    if (!allowed) {
      const mins = Math.max(1, Math.ceil(retryAfterMs / 60_000));
      return fail(429, `Too many reset requests for this account. Please try again in about ${mins} minute(s).`, {
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      });
    }

    let user: { _id: string; orgId: string; phone?: string | null; active: boolean } | null = null;
    try {
      user = await cx().query(api.auth.getUserByEmail, { secret: secret(), email });
    } catch {
      /* ignore */
    }

    // Only send when the account exists, is active and has a phone number.
    if (user && user.active && user.phone) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      try {
        await cx().mutation(api.passwordReset.createReset, {
          secret: secret(),
          orgId: user.orgId as never,
          userId: user._id as never,
          codeHash: bcrypt.hashSync(code, 10),
          expiresAt: Date.now() + CODE_TTL_MS,
        });
        await sendSMS(
          user.phone,
          `Your Office Manager password reset code is ${code}. It expires in 10 minutes. If you did not request this, ignore this message.`
        );
      } catch (e) {
        console.error("[forgot-password] send failed:", e);
      }
    }

    return ok({ ok: true });
  });
}
