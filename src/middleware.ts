import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { rateLimit, clientIp, rateLimitKey } from "./lib/rateLimit";
import { SESSION_COOKIE_NAMES } from "./lib/sessionCookie";
import { TERMS_VERSION } from "./lib/terms";

const PUBLIC_PAGES = [
  "/",
  "/login",
  "/forgot-password",
  "/terms",
  "/privacy",
  "/cookie-policy",
  "/pricing",
  "/security",
  "/about",
  "/templates",
  "/status",
];
const PUBLIC_PAGES_PREFIXES = ["/solutions", "/resources", "/industries", "/.well-known"];
const PUBLIC_APIS = [
  "/api/auth/login",
  "/api/enquiries",
  "/api/public",
  "/api/health",
  "/api/cron",
  // Shared-secret sync runners (no session cookie; authorised by their own secret).
  "/api/integrations/sync/run",
  "/api/crm/integrations/sync/run",
];

interface MiddlewareSession {
  mustChangePassword?: boolean;
  role?: string;
  termsAgreedAt?: boolean;
  termsVersion?: string;
  id?: string;
  orgId?: string;
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

  // ---- Content-Security-Policy ----
  // Next.js serves some pages statically, where per-request script nonces are
  // not available; a nonce + 'strict-dynamic' policy would block those scripts.
  // We therefore allow same-origin/inline scripts while locking down everything
  // else (no external scripts, objects or framing). XSS is additionally
  // mitigated because the app renders untrusted data through React (no HTML
  // injection sinks).
  const isApi = pathname.startsWith("/api");
  const isPublic = isApi
    ? PUBLIC_APIS.some((p) => pathname.startsWith(p))
    : PUBLIC_PAGES.includes(pathname) || PUBLIC_PAGES_PREFIXES.some((p) => pathname.startsWith(p));

  const dev = process.env.NODE_ENV !== "production";

  // Public marketing pages do not talk to the application backend directly, so
  // they get a tighter policy that does not advertise backend/provider domains.
  // Signed-in app pages keep the broader policy they need for file and data
  // access. The marketing site's images and scripts are all first-party.
  const baseCsp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  const appCsp = [
    "img-src 'self' data: blob: https://*.convex.cloud https://*.convex.site https://uploadthing.com https://*.uploadthing.com https://*.ufs.sh https://utfs.io",
    "connect-src 'self' https://*.convex.cloud https://*.convex.site https://*.uploadthing.com https://*.ufs.sh https://utfs.io https://*.ingest.sentry.io https://*.sentry.io",
    "media-src 'self' blob: https://*.convex.cloud https://uploadthing.com https://*.uploadthing.com https://*.ufs.sh https://utfs.io",
    "frame-src 'self' blob: https://*.convex.cloud",
  ];
  const publicCsp = [
    "img-src 'self' data: blob:",
    "connect-src 'self' https://*.ingest.sentry.io https://*.sentry.io",
    "media-src 'self' blob:",
    "frame-src 'self' blob:",
  ];
  const csp = [...baseCsp, ...(isPublic ? publicCsp : appCsp)].join("; ");

  const withCsp = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };
  const nextRes = () => withCsp(NextResponse.next());
  const jsonRes = (body: unknown, init?: ResponseInit) => withCsp(NextResponse.json(body, init));
  const redirectRes = (url: URL) => withCsp(NextResponse.redirect(url));

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

  const isAuthApi = pathname === "/api/auth" || pathname.startsWith("/api/auth/");
  const isChangePassword = pathname === "/change-password" || pathname === "/api/auth/change-password";

  // ---- CSRF / cross-site guard for every state-changing request ----
  // Browsers send Sec-Fetch-Site on modern requests. Blocking cross-site
  // mutations also covers server actions and cases where Origin is stripped.
  if (
    MUTATING_METHODS.has(req.method) &&
    req.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return withCsp(new NextResponse("Cross-site request blocked", { status: 403 }));
  }
  if (isApi && MUTATING_METHODS.has(req.method) && !originAllowed(req)) {
    return jsonRes({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  // ---- Rate limiting (per-instance, in-memory) ----
  if (isApi) {
    const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
    const isLogin = pathname === "/api/auth" || pathname === "/api/auth/login";
    const address = clientIp(req);

    // Authenticated requests are keyed by organisation + user, never by IP, so
    // colleagues sharing an office IP cannot throttle each other. Unauthenticated
    // requests (login, public forms) fall back to IP.
    const key = rateLimitKey(session, address);
    const scope = isLogin ? "login" : isWrite ? "w" : "r";

    // Login is stricter; authed requests get generous limits.
    const cfg = isLogin
      ? { limit: 120, windowMs: 60_000 }
      : isWrite
      ? { limit: isPublic ? 10 : 120, windowMs: 60_000 }
      : { limit: isPublic ? 60 : 300, windowMs: 60_000 };

    if (!rateLimit({ key: `${key}:${scope}`, ...cfg })) {
      const retryAfter = Math.ceil(cfg.windowMs / 1000);
      return jsonRes(
        { error: "Too many requests. Please slow down and try again.", retryAfterSeconds: retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
  }

  if (!session) {
    if (isPublic || (isApi && isAuthApi)) return nextRes();
    if (isApi) return jsonRes({ error: "Not authenticated" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return redirectRes(url);
  }

  // Force password change until done
  if (session.mustChangePassword && !isChangePassword && !isAuthApi) {
    if (isApi) return jsonRes({ error: "Password change required", code: "MUST_CHANGE_PASSWORD" }, { status: 403 });
    const url = req.nextUrl.clone();
    url.pathname = "/change-password";
    return redirectRes(url);
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
    if (isApi) return jsonRes({ error: "Terms acceptance required", code: "TERMS_REQUIRED" }, { status: 403 });
    const url = req.nextUrl.clone();
    url.pathname = "/accept-terms";
    return redirectRes(url);
  }

  // Already logged in, skip login page; land authed users on the dashboard
  if (!isApi && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = session.role === "super_admin" ? "/admin" : "/dashboard";
    return redirectRes(url);
  }
  if (!isApi && pathname === "/" && session) {
    const url = req.nextUrl.clone();
    url.pathname = session.role === "super_admin" ? "/admin" : "/dashboard";
    return redirectRes(url);
  }

  return nextRes();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|ico|webp|webmanifest|js|css|json|txt|xml|xlsx|xls|csv|pdf|woff2?|ttf|map|mp4|webm|ogv|ogg|mp3|wav|m4a|mov)$).*)"],
};
