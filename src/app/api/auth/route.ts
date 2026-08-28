import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { setSessionCookie, clearSessionCookie, getSession, HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError, ensureAppInit } from "@/lib/convex";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson<{ email: string; password: string }>(req);
    requireFields(body, ["email", "password"]);

    await ensureAppInit();

    let user;
    try {
      user = await cx().query(api.auth.getUserByEmail, {
        secret: secret(),
        email: String(body.email).toLowerCase().trim(),
      });
    } catch (e) {
      return mapConvexError(e);
    }

    if (!user || !user.active || !bcrypt.compareSync(String(body.password), user.passwordHash)) {
      throw new HttpError(401, "Invalid email or password");
    }

    await setSessionCookie({
      id: user._id,
      orgId: user.orgId,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: !!user.mustChangePassword,
    });
    return ok({ role: user.role, mustChangePassword: !!user.mustChangePassword });
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
      },
    });
  });
}
