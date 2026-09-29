import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { rateLimit, clientIp } from "./lib/rateLimit";
import { SESSION_COOKIE_NAMES } from "./lib/sessionCookie";
import { TERMS_VERSION } from "./lib/terms";

const PUBLIC_PAGES = ["/", "/login", "/forgot-password", "/terms", "/privacy", "/cookie-policy"];
const PUBLIC_PAGES_PREFIXES = ["/solutions"];
const PUBLIC_APIS = ["/api/auth/login", "/api/enquiries", "/api/public", "/api/health", "/api/cron"];

interface MiddlewareSession {
  mustChangePassword?: boolean;
  role?: string;
  termsAgreedAt?: boolean;
  termsVersion?: string;
  id?: string;
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET || "";
  return new TextEncoder().encode(s);
}

// Extra hosts that are allowed to call the API (in addition to same-host).
const TRUSTED_API_HOSTS = new Set([
  "office-manager-six.vercel.app",
  "officemanager.pigiecore.co.ke",
]);

/**
 * CSRF / origin guard. Requests are only allowed when they are same-origin
 * (Origin matches the Host header) or originate from a trusted app host.
 * Requests with no Origin/Referer (non-browser clients, server-to-server)
 * are allowed: they carry no ambient session cookie, so they cannot abuse an
 * authenticated browser session. Browsers always send Origin on state-changing
 * requests, which is exactly what this defends against.
 */
function originAllowed(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  if (!origin && !referer) return true;
  let candidate = origin;
  if (!candidate && referer) {
    try {
      candidate = new URL(referer).origin;
    } catch {
      return false;
    }
  }
  if (!candidate) return true;
  try {
    const o = new URL(candidate);
    const host = req.headers.get("host") ?? "";
    if (o.host === host) return true;
    if (TRUSTED_API_HOSTS.has(o.host)) return true;
  } catch {
    /* fallthrough */
  }
  return false;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token =
    req.cookies.get(SESSION_COOKIE_NAMES[0])?.value ||
    req.cookies.get(SESSION_COOKIE_NAMES[1])?.value;

  let session: MiddlewareSession | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret());
      session = payload as Record<string, unknown>;
    } catch {
      session = null;
    }
  }

  const isApi = pathname.startsWith("/api");
  const isPublic = isApi
    ? PUBLIC_APIS.some((p) => pathname.startsWith(p))
    : PUBLIC_PAGES.includes(pathname) || PUBLIC_PAGES_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthApi = pathname === "/api/auth" || pathname.startsWith("/api/auth/");
  const isChangePassword = pathname === "/change-password" || pathname === "/api/auth/change-password";

  // ---- Origin guard (CSRF) for state-changing API requests ----
  if (isApi && MUTATING_METHODS.has(req.method) && !originAllowed(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  // ---- Rate limiting (per-instance, in-memory) ----
  if (isApi) {
    const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
    const isLogin = pathname === "/api/auth" || pathname === "/api/auth/login";
    const address = clientIp(req);

    // Key by authenticated user where possible, otherwise by IP.
    const key = session?.id ? `u:${session.id}` : `ip:${address}`;
    const scope = isLogin ? "login" : isWrite ? "w" : "r";

    // Login is stricter; authed requests get generous limits.
    const cfg = isLogin
      ? { limit: 30, windowMs: 60_000 }
      : isWrite
      ? { limit: isPublic ? 10 : 120, windowMs: 60_000 }
      : { limit: isPublic ? 60 : 300, windowMs: 60_000 };

    if (!rateLimit({ key: `${key}:${scope}`, ...cfg })) {
      const retryAfter = Math.ceil(cfg.windowMs / 1000);
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again.", retryAfterSeconds: retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
  }

  if (!session) {
    if (isPublic || (isApi && isAuthApi)) return NextResponse.next();
    if (isApi) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Force password change until done
  if (session.mustChangePassword && !isChangePassword && !isAuthApi) {
    if (isApi) return NextResponse.json({ error: "Password change required", code: "MUST_CHANGE_PASSWORD" }, { status: 403 });
    const url = req.nextUrl.clone();
    url.pathname = "/change-password";
    return NextResponse.redirect(url);
  }

  // Force Terms & Conditions acceptance until done (skip platform admins and legal pages).
  // Password change takes precedence: a user who must change their password is
  // allowed to reach /change-password even if they have not accepted terms yet,
  // otherwise the two rules redirect to each other in a loop.
  const isAcceptTerms = pathname === "/accept-terms";
  const isLegalPage = pathname === "/terms" || pathname === "/privacy";
  // Accepted once, and still current. Sessions that predate versioning (no
  // termsVersion) are grandfathered so existing users aren't re-prompted.
  const termsAccepted =
    !!session.termsAgreedAt &&
    (session.termsVersion === undefined || session.termsVersion === TERMS_VERSION);
  if (
    session.role !== "super_admin" &&
    !termsAccepted &&
    !isAcceptTerms &&
    !isLegalPage &&
    !isAuthApi &&
    !isChangePassword
  ) {
    if (isApi) return NextResponse.json({ error: "Terms acceptance required", code: "TERMS_REQUIRED" }, { status: 403 });
    const url = req.nextUrl.clone();
    url.pathname = "/accept-terms";
    return NextResponse.redirect(url);
  }

  // Already logged in, skip login page; land authed users on the dashboard
  if (!isApi && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = session.role === "super_admin" ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }
  if (!isApi && pathname === "/" && session) {
    const url = req.nextUrl.clone();
    url.pathname = session.role === "super_admin" ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|ico|webp|webmanifest|js|css|json|txt|xml|woff2?|ttf|map|mp4|webm|ogv|ogg|mp3|wav|m4a|mov)$).*)"],
};
