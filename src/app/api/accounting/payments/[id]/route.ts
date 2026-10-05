import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** DELETE /api/accounting/payments/[id] — void a receipt/payment (reverse + unapply). */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("accounting-reverse", ["admin"]);
    const { id } = await ctx.params;
    try {
      await cx().mutation(api.subledger.voidPayment, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
      await recordAudit(session, {
        action: "accounting.payment_void",
        module: "accounting",
        summary: "Voided a receipt/payment",
        targetType: "payment",
        targetId: id,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
