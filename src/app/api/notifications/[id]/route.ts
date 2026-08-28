import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Mark a single notification as read. */
export async function PATCH(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser();
    const { id } = await ctx.params;
    try {
      await cx().mutation(api.notifications.markRead, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
      return ok({ read: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
