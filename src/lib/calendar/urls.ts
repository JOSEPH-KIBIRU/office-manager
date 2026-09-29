import { headers } from "next/headers";

export async function requestOrigin(): Promise<string> {
  // Prefer the host the user is actually on — our session cookie is host-only,
  // so the OAuth callback must return to the same host or the session is lost.
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  if (host) {
    const proto = (h.get("x-forwarded-proto") || "https").split(",")[0].trim();
    return `${proto}://${host}`;
  }
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function calendarRedirectUri(origin: string, provider: string): string {
  return `${origin}/api/integrations/${provider}/callback`;
}
