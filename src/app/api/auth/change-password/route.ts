import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getSession, setSessionCookie, HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson<{ currentPassword: string; newPassword: string }>(req);
    requireFields(body, ["currentPassword", "newPassword"]);

    const session = await getSession();
    if (!session || !session.orgId) throw new HttpError(401, "Not authenticated");

    if (String(body.newPassword).length < 8) {
      throw new HttpError(400, "New password must be at least 8 characters");
    }

    const user = await cx().query(api.auth.getUserById, {
      secret: secret(),
      id: session.id as never,
      orgId: session.orgId as never,
    });
    if (!user) throw new HttpError(401, "Account not found");
    if (!bcrypt.compareSync(String(body.currentPassword), user.passwordHash)) {
      throw new HttpError(400, "Current password is incorrect");
    }
    if (bcrypt.compareSync(String(body.newPassword), user.passwordHash)) {
      throw new HttpError(400, "New password must be different from the current one");
    }

    try {
      await cx().mutation(api.users.patchUser, {
        secret: secret(),
        orgId: session.orgId as never,
        id: user._id,
        newPasswordHash: bcrypt.hashSync(String(body.newPassword), 10),
        mustChangePassword: false,
      });
    } catch (e) {
      return mapConvexError(e);
    }

    await setSessionCookie({ ...session, mustChangePassword: false });
    return ok();
  });
}
