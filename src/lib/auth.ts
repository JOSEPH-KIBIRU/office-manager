import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Role, SessionPayload } from "./types";

const COOKIE_NAME = "om_session";
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
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

function shouldUseSecureCookies(): boolean {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === "true";
  // Auto: only mark Secure when the app is served over HTTPS
  return (process.env.APP_URL || "").startsWith("https");
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
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
