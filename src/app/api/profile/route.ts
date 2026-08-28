import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api } from "@/lib/convex";

export async function GET() {
  return handle(async () => {
    const session = await requireUser();
    const profile = await cx().query(api.auth.getUserById, {
      secret: secret(),
      id: session.id as never,
      orgId: session.orgId as never,
    });
    if (!profile) throw new HttpError(401, "Account not found");
    return ok({
      profile: {
        id: profile._id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone ?? null,
        role: profile.role,
        leave_balance: profile.leaveBalance,
        active: profile.active ? 1 : 0,
        created_at: new Date(profile.createdAt).toISOString().replace("T", " ").slice(0, 19),
      },
    });
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser();
    const body = await readJson<{ phone?: string }>(req);

    if (body.phone !== undefined) {
      const phone = String(body.phone).trim();
      if (phone && !/^\+?[0-9\s-]{9,15}$/.test(phone)) {
        throw new HttpError(400, "Invalid phone number format");
      }
      await cx().mutation(api.users.patchUser, {
        secret: secret(),
        orgId: session.orgId as never,
        id: session.id as never,
        phone,
      });
    }

    const profile = await cx().query(api.auth.getUserById, {
      secret: secret(),
      id: session.id as never,
      orgId: session.orgId as never,
    });
    return ok({
      profile: {
        id: profile!._id,
        name: profile!.name,
        email: profile!.email,
        phone: profile!.phone ?? null,
        role: profile!.role,
        leave_balance: profile!.leaveBalance,
      },
      note: "Phone number updated.",
    });
  });
}
