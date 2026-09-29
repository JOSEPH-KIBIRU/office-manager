import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Role, SessionPayload } from "./types";
import { shouldUseSecureCookies, sessionCookieName, SESSION_COOKIE_NAMES } from "./sessionCookie";
import { TERMS_VERSION } from "./terms";

const SESSION_DAYS = 7;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET env var must be set (min 16 chars)");
  return new TextEncoder().encode(s);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.id) return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(sessionCookieName())?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(sessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  // __Host- cookies require Secure on the *deletion* Set-Cookie too, otherwise
  // the browser rejects the removal and logout silently fails. Clear both the
  // current cookie name and any legacy name with the matching attributes.
  const secure = shouldUseSecureCookies();
  for (const name of SESSION_COOKIE_NAMES) {
    store.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: name.startsWith("__Host-") ? true : secure,
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  }
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(roles?: Role[]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || !session.orgId) throw new HttpError(401, "Not authenticated");
  if (roles && roles.length > 0 && !roles.includes(session.role)) {
    throw new HttpError(403, "You do not have permission to perform this action");
  }
  return session;
}

export async function startImpersonation(
  session: SessionPayload,
  targetOrgId: string,
  companyName: string,
  asUser: { id: string; name: string; email: string }
) {
  const payload: SessionPayload = {
    // Act as a real admin of the target company (its user id), so org-scoped
    // personal queries resolve correctly inside the company.
    id: asUser.id,
    orgId: targetOrgId,
    name: asUser.name,
    email: asUser.email,
    role: "admin",
    mustChangePassword: false,
    termsAgreedAt: true,
    termsVersion: TERMS_VERSION,
    impersonating: {
      originalId: session.id,
      originalOrgId: session.orgId,
      originalRole: session.role,
      originalName: session.name,
      originalEmail: session.email,
      companyName,
    },
  };
  await setSessionCookie(payload);
  return payload;
}

export async function stopImpersonation(session: SessionPayload): Promise<SessionPayload | null> {
  if (!session.impersonating) return null;
  const original: SessionPayload = {
    id: session.impersonating.originalId,
    orgId: session.impersonating.originalOrgId,
    name: session.impersonating.originalName,
    email: session.impersonating.originalEmail,
    role: session.impersonating.originalRole,
    mustChangePassword: false,
    termsAgreedAt: true,
    termsVersion: TERMS_VERSION,
  };
  await setSessionCookie(original);
  return original;
}

/** Short-lived token proving the password step succeeded (for 2FA step 2). */
export async function signTwoFactorChallenge(userId: string, orgId: string): Promise<string> {
  return new SignJWT({ tfa: true, uid: userId, oid: orgId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret());
}

export async function verifyTwoFactorChallenge(token: string): Promise<{ userId: string; orgId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.tfa || !payload.uid || !payload.oid) return null;
    return { userId: String(payload.uid), orgId: String(payload.oid) };
  } catch {
    return null;
  }
}
