import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { setSessionCookie, verifyTwoFactorChallenge, HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { verifyTotp } from "@/lib/totp";
import { TERMS_BASELINE_VERSION } from "@/lib/terms";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/** Second login step: verify the authenticator (or a recovery) code. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson<{ challenge: string; code: string }>(req);
    requireFields(body, ["challenge", "code"]);

    const ip = clientIp(req);
    if (!rateLimit({ key: `2fa:ip:${ip}`, limit: 20, windowMs: 5 * 60_000 })) {
      throw new HttpError(429, "Too many attempts. Please wait a few minutes and try again.");
    }

    const challenge = await verifyTwoFactorChallenge(String(body.challenge));
    if (!challenge) throw new HttpError(400, "Your login attempt expired. Please sign in again.");

    const user = await cx().query(api.auth.getUserById, {
      secret: secret(),
      id: challenge.userId as never,
      orgId: challenge.orgId as never,
    });
    if (!user || !user.active || !user.twoFactorEnabledAt) {
      throw new HttpError(400, "Two-factor authentication is not enabled for this account.");
    }

    const code = String(body.code).trim();
    const okTotp = user.twoFactorSecret ? verifyTotp(user.twoFactorSecret, code) : false;
    let okRecovery = false;
    let usedHash: string | null = null;
    if (!okTotp) {
      for (const h of user.twoFactorRecoveryHashes ?? []) {
        if (bcrypt.compareSync(code, h)) {
          okRecovery = true;
          usedHash = h;
          break;
        }
      }
    }
    if (!okTotp && !okRecovery) throw new HttpError(400, "Invalid code. Try again or use a recovery code.");

    if (okRecovery && usedHash) {
      const remaining = (user.twoFactorRecoveryHashes ?? []).filter((h) => h !== usedHash);
      await cx().mutation(api.twofa.setRecoveryHashes, {
        secret: secret(),
        orgId: challenge.orgId as never,
        userId: challenge.userId as never,
        recoveryHashes: remaining,
      });
    }

    try {
      const org = await cx().query(api.organizations.getOrganization, {
        secret: secret(),
        orgId: challenge.orgId as never,
      });
      if (!org || !org.active || org.deletedAt) {
        throw new HttpError(403, "This company has been suspended. Please contact support.");
      }
    } catch (e) {
      if (e instanceof HttpError) throw e;
      return mapConvexError(e);
    }

    let termsVersion = user.termsVersion as string | undefined;
    if (user.termsAgreedAt && !termsVersion) {
      termsVersion = TERMS_BASELINE_VERSION;
      try {
        await cx().mutation(api.users.patchUser, {
          secret: secret(),
          orgId: challenge.orgId as never,
          id: challenge.userId as never,
          termsVersion,
        });
      } catch {
        /* non-fatal */
      }
    }

    await setSessionCookie({
      id: user._id,
      orgId: user.orgId,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: !!user.mustChangePassword,
      termsAgreedAt: !!user.termsAgreedAt,
      termsVersion,
    });

    try {
      await cx().mutation(api.auth.recordLogin, {
        secret: secret(),
        userId: user._id as never,
        orgId: user.orgId as never,
      });
    } catch {
      /* non-fatal */
    }

    return ok({ role: user.role, mustChangePassword: !!user.mustChangePassword, termsAgreedAt: !!user.termsAgreedAt });
  });
}
