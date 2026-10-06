import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** PATCH /api/accounting/recurring/[id] */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const { id } = await ctx.params;
    const body = await readJson<{ active?: boolean; amount?: number; endDate?: string; nextRun?: string }>(req);
    try {
      await cx().mutation(api.recurring.updateRecurring, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        active: body.active,
        amount: body.amount !== undefined ? Number(body.amount) : undefined,
        endDate: body.endDate,
        nextRun: body.nextRun,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** DELETE /api/accounting/recurring/[id] */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const { id } = await ctx.params;
    try {
      await cx().mutation(api.recurring.deleteRecurring, { secret: secret(), orgId: session.orgId as never, id: id as never });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
