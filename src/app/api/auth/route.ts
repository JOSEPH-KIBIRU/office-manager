import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { setSessionCookie, clearSessionCookie, getSession, HttpError, signTwoFactorChallenge } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError, ensureAppInit } from "@/lib/convex";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { TERMS_BASELINE_VERSION } from "@/lib/terms";
import { recordAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson<{ email: string; password: string }>(req);
    requireFields(body, ["email", "password"]);

    const ip = clientIp(req);
    const email = String(body.email).toLowerCase().trim();

    // Brute-force protection: cap attempts per client IP, and slow down
    // repeated attempts against a single account from the same IP.
    if (!rateLimit({ key: `login:ip:${ip}`, limit: 20, windowMs: 5 * 60_000 })) {
      throw new HttpError(429, "Too many login attempts. Please wait a few minutes and try again.");
    }
    if (!rateLimit({ key: `login:acct:${email}:${ip}`, limit: 6, windowMs: 5 * 60_000 })) {
      throw new HttpError(429, "Too many attempts for this account. Please wait a few minutes and try again.");
    }
    // Global per-account bucket shared across all serverless instances, so an
    // attacker rotating many IPs still cannot hammer one account endlessly.
    const shared = await cx().mutation(api.rateLimit.hit, {
      secret: secret(),
      key: `login:acct:${email}`,
      limit: 20,
      windowMs: 10 * 60_000,
    });
    if (!shared.allowed) {
      throw new HttpError(429, "Too many login attempts for this account. Please wait a few minutes and try again.");
    }

    await ensureAppInit();

    let user;
    try {
      user = await cx().query(api.auth.getUserByEmail, {
        secret: secret(),
        email,
      });
    } catch (e) {
      return mapConvexError(e);
    }

    if (!user || !user.active || !bcrypt.compareSync(String(body.password), user.passwordHash)) {
      throw new HttpError(401, "Invalid email or password");
    }

    // A suspended company must not be able to log in.
    try {
      const org = await cx().query(api.organizations.getOrganization, {
        secret: secret(),
        orgId: user.orgId,
      });
      if (!org || !org.active || org.deletedAt) {
        throw new HttpError(403, "This company has been suspended. Please contact support.");
      }
    } catch (e) {
      if (e instanceof HttpError) throw e;
      return mapConvexError(e);
    }

    // Second factor: hand back a short-lived challenge instead of a session.
    if (user.twoFactorEnabledAt) {
      const challenge = await signTwoFactorChallenge(user._id, user.orgId);
      return ok({ twoFactorRequired: true, challenge });
    }

    // Grandfather prior acceptances to the current terms version so existing
    // users aren't re-prompted; a future version bump still requires acceptance.
    let termsVersion = user.termsVersion as string | undefined;
    if (user.termsAgreedAt && !termsVersion) {
      termsVersion = TERMS_BASELINE_VERSION;
      try {
        await cx().mutation(api.users.patchUser, {
          secret: secret(),
          orgId: user.orgId as never,
          id: user._id as never,
          termsVersion,
        });
      } catch (e) {
        console.error("[auth] terms backfill failed:", e);
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

    // Track last access (per user and per company) — non-fatal if it fails.
    try {
      await cx().mutation(api.auth.recordLogin, {
        secret: secret(),
        userId: user._id as never,
        orgId: user.orgId as never,
      });
    } catch (e) {
      console.error("[auth] recordLogin failed:", e);
    }

    await recordAudit(
      { id: user._id, orgId: user.orgId, name: user.name, role: user.role } as never,
      { action: "login", module: "auth", summary: `${user.name} signed in` },
      ip
    );

    return ok({ role: user.role, mustChangePassword: !!user.mustChangePassword, termsAgreedAt: !!user.termsAgreedAt });
  });
}

export async function DELETE() {
  return handle(async () => {
    await clearSessionCookie();
    return ok();
  });
}

export async function GET() {
  return handle(async () => {
    const session = await getSession();
    if (!session) throw new HttpError(401, "Not authenticated");
    const profile = await cx().query(api.auth.getUserById, {
      secret: secret(),
      id: session.id as never,
      orgId: session.orgId as never,
    });
    if (!profile) throw new HttpError(401, "Account not found");
    return ok({
      user: session,
      profile: {
        id: profile._id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone ?? null,
        role: profile.role,
        leave_balance: profile.leaveBalance,
        terms_agreed_at: profile.termsAgreedAt ?? null,
      },
    });
  });
}
