import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** PATCH /api/banking/rules/[id] — toggle active / autoPost. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const { id } = await ctx.params;
    const body = await readJson<{ active?: boolean; autoPost?: boolean }>(req);
    try {
      await cx().mutation(api.banking.updateBankRule, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        active: body.active,
        autoPost: body.autoPost,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** DELETE /api/banking/rules/[id] */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const { id } = await ctx.params;
    try {
      await cx().mutation(api.banking.deleteBankRule, { secret: secret(), orgId: session.orgId as never, id: id as never });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
