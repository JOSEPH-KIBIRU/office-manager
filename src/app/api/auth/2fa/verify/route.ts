import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { setSessionCookie, verifyTwoFactorChallenge, HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { verifyTotp } from "@/lib/totp";
import { decryptTotpSecret, encryptTotpSecret } from "@/lib/twofaSecret";
import { decryptToken } from "@/lib/email/crypto";
import { TERMS_BASELINE_VERSION, TERMS_VERSION } from "@/lib/terms";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { allowDistributed } from "@/lib/distributedRateLimit";

/** Second login step: verify the authenticator (or a recovery) code. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson<{ challenge: string; code: string }>(req);
    requireFields(body, ["challenge", "code"]);

    const ip = clientIp(req);
    // The signed challenge carries the account, so we can rate-limit per
    // organisation + user instead of per shared office IP. Invalid challenges
    // still fall back to the IP bucket.
    const challenge = await verifyTwoFactorChallenge(String(body.challenge));
    const rateKey = challenge
      ? `2fa:org:${challenge.orgId}:user:${challenge.userId}`
      : `2fa:ip:${ip}`;
    if (!rateLimit({ key: rateKey, limit: 20, windowMs: 5 * 60_000 })) {
      throw new HttpError(429, "Too many attempts. Please wait a few minutes and try again.");
    }
    if (challenge) {
      const gate = await allowDistributed(
        `2fa:org:${challenge.orgId}:user:${challenge.userId}`,
        20,
        5 * 60_000
      );
      if (!gate.allowed) {
        throw new HttpError(429, "Too many attempts. Please wait a few minutes and try again.");
      }
    }
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
    const totpSecret = decryptTotpSecret(user.twoFactorSecret);
    const okTotp = totpSecret ? verifyTotp(totpSecret, code) : false;
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

    // Migrate legacy plaintext TOTP secrets to encrypted-at-rest on success.
    if (okTotp && user.twoFactorSecret && totpSecret) {
      let legacyPlaintext = false;
      try {
        decryptToken(user.twoFactorSecret);
      } catch {
        legacyPlaintext = true;
      }
      if (legacyPlaintext) {
        try {
          await cx().mutation(api.twofa.setPendingSecret, {
            secret: secret(),
            orgId: challenge.orgId as never,
            userId: challenge.userId as never,
            twoFactorSecret: encryptTotpSecret(totpSecret),
          });
        } catch {
          /* non-fatal: 2FA still succeeds */
        }
      }
    }

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

    const termsAgreedAt = user.role === "super_admin" ? true : !!user.termsAgreedAt;
    await setSessionCookie({
      id: user._id,
      orgId: user.orgId,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: !!user.mustChangePassword,
      termsAgreedAt,
      termsVersion: user.role === "super_admin" ? TERMS_VERSION : termsVersion,
      sessionVersion: user.sessionVersion ?? 0,
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

    return ok({ role: user.role, mustChangePassword: !!user.mustChangePassword, termsAgreedAt });
  });
}
