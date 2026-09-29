import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("invoices", ["admin", "manager", "secretary"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
    }>(req);
    if (!body.status) throw new Error("Status is required");
    try {
      await cx().mutation(api.invoicing.setInvoiceStatus, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        status: body.status as never,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
