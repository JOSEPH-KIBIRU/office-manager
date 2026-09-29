import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { verifyTotp } from "@/lib/totp";

function makeRecoveryCodes(n = 10): string[] {
  return Array.from({ length: n }, () => {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
  });
}

/** Confirm the first code and switch 2FA on; returns one-time recovery codes. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser();
    const body = await readJson<{ code?: string }>(req);
    if (!body.code) throw new HttpError(400, "Enter the 6-digit code from your authenticator app");

    const user = await cx().query(api.auth.getUserById, {
      secret: secret(),
      id: session.id as never,
      orgId: session.orgId as never,
    });
    if (!user?.twoFactorSecret) throw new HttpError(400, "Start the setup again");
    if (!verifyTotp(user.twoFactorSecret, String(body.code))) {
      throw new HttpError(400, "That code is not valid. Check your phone's clock and try again.");
    }

    const recoveryCodes = makeRecoveryCodes();
    try {
      await cx().mutation(api.twofa.enable, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: session.id as never,
        recoveryHashes: recoveryCodes.map((c) => bcrypt.hashSync(c, 10)),
      });
    } catch (e) {
      return mapConvexError(e);
    }
    return ok({ recoveryCodes });
  });
}
