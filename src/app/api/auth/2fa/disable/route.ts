import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { verifyTotp } from "@/lib/totp";

/** Turn 2FA off (requires a current authenticator or recovery code). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser();
    const body = await readJson<{ code?: string }>(req);
    if (!body.code) throw new HttpError(400, "Enter a code to turn off 2FA");

    const user = await cx().query(api.auth.getUserById, {
      secret: secret(),
      id: session.id as never,
      orgId: session.orgId as never,
    });
    if (!user?.twoFactorEnabledAt) throw new HttpError(400, "Two-factor authentication is not enabled");

    const code = String(body.code).trim();
    const okTotp = user.twoFactorSecret ? verifyTotp(user.twoFactorSecret, code) : false;
    const okRecovery = (user.twoFactorRecoveryHashes ?? []).some((h) => bcrypt.compareSync(code, h));
    if (!okTotp && !okRecovery) throw new HttpError(400, "That code is not valid");

    try {
      await cx().mutation(api.twofa.disable, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: session.id as never,
      });
    } catch (e) {
      return mapConvexError(e);
    }
    return ok({ enabled: false });
  });
}
