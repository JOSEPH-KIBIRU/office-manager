import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Update a visitor's status. Reception only (admin + secretary). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("visitors", ["admin", "secretary"]);
    const { id } = await ctx.params;
    const body = await readJson<{ status?: "pending" | "seen" | "completed" }>(req);
    if (!body.status) throw new HttpError(400, "Status is required");

    try {
      const res = await cx().mutation(api.visitors.updateVisitorStatus, {
        secret: secret(),
        orgId: session.orgId as never,
        viewerId: session.id as never,
        id: id as never,
        status: body.status,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Delete a visitor record. Admin only. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("visitors", ["admin"]);
    const { id } = await ctx.params;

    try {
      const res = await cx().mutation(api.visitors.deleteVisitor, {
        secret: secret(),
        orgId: session.orgId as never,
        viewerId: session.id as never,
        id: id as never,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
