import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Update an asset. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("assets", ["admin", "secretary"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      tag?: string;
      name?: string;
      category?: string;
      serialNumber?: string;
      condition?: string;
      status?: "available" | "assigned" | "maintenance" | "retired";
      active?: boolean;
    }>(req);

    try {
      const res = await cx().mutation(api.assets.updateAsset, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        tag: body.tag,
        name: body.name,
        category: body.category,
        serialNumber: body.serialNumber,
        condition: body.condition,
        status: body.status,
        active: body.active,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Delete an asset (must not be checked out). */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("assets", ["admin", "secretary"]);
    const { id } = await ctx.params;
    try {
      const res = await cx().mutation(api.assets.deleteAsset, {
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
