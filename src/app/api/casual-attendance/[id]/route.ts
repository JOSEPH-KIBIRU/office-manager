import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Delete a casual attendance record. Admin only. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("payroll", ["admin"]);
    const { id } = await ctx.params;
    try {
      const res = await cx().mutation(api.payroll.deleteCasualAttendance, {
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
