import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** Owner only: remove a delegated superadmin. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const { id } = await ctx.params;

    const { isOwner } = (await cx().query(api.superadmin.isPlatformOwner, {
      secret: secret(),
      superAdminId: session.id as never,
    })) as { isOwner: boolean };
    if (!isOwner) throw new HttpError(403, "Only the platform owner can remove superadmins");

    try {
      const result = await cx().mutation(api.superadmin.deletePlatformAdmin, {
        secret: secret(),
        superAdminId: session.id as never,
        id: id as never,
      });
      await recordAudit(session, {
        action: "platform.superadmin.delete",
        module: "platform",
        summary: `Removed superadmin ${id}`,
        targetType: "user",
        targetId: id,
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
