import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "om_session";

const PUBLIC_PAGES = ["/", "/login"];
const PUBLIC_APIS = ["/api/auth/login"];

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET || "";
  return new TextEncoder().encode(s);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;

  let session: { mustChangePassword?: boolean; role?: string } | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret());
      session = payload as Record<string, unknown>;
    } catch {
      session = null;
    }
  }

  const isApi = pathname.startsWith("/api");
  const isPublic = isApi ? PUBLIC_APIS.some((p) => pathname.startsWith(p)) : PUBLIC_PAGES.includes(pathname);
  const isAuthApi = pathname === "/api/auth" || pathname.startsWith("/api/auth/");
  const isChangePassword = pathname === "/change-password" || pathname === "/api/auth/change-password";

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
