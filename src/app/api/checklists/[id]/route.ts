import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("onboarding", ["admin", "secretary"]);
    const { id } = await ctx.params;
    const body = await readJson<{ done: boolean }>(req);
    try {
      const res = await cx().mutation(api.checklists.toggleItem, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        done: !!body.done,
        viewerId: session.id as never,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("onboarding", ["admin", "secretary"]);
    const { id } = await ctx.params;
    try {
      const res = await cx().mutation(api.checklists.deleteItem, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
