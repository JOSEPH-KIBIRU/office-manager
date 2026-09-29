import "server-only";
import { SignJWT, jwtVerify } from "jose";

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET env var must be set (min 16 chars)");
  return new TextEncoder().encode(s);
}

export interface OAuthState {
  userId: string;
  orgId: string;
  provider: string;
}

export async function signOAuthState(state: OAuthState): Promise<string> {
  return new SignJWT({ ...state })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret());
}

export async function verifyOAuthState(token: string): Promise<OAuthState | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.userId || !payload.orgId || !payload.provider) return null;
    return payload as unknown as OAuthState;
  } catch {
    return null;
  }
}
