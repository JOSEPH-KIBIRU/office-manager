/**
 * Session cookie naming/security. Uses the `__Host-` prefix whenever cookies
 * are Secure (production over HTTPS) — this forbids the cookie being set with a
 * Domain attribute or a non-/ path, which protects against domain shadowing.
 * In development (http) the plain name is used because browsers reject
 * `__Host-` cookies unless Secure.
 */

/** Absolute session lifetime, enforced on both new and existing tokens. */
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

export function shouldUseSecureCookies(): boolean {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === "true";
  return (process.env.APP_URL || "").startsWith("https");
}

export function sessionCookieName(): string {
  return shouldUseSecureCookies() ? "__Host-om_session" : "om_session";
}

/** Both possible names, for readers that cannot run env-dependent logic (edge middleware). */
export const SESSION_COOKIE_NAMES = ["__Host-om_session", "om_session"] as const;
