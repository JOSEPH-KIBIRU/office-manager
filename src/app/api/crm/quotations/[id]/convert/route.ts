import { NextRequest } from "next/server";
import { requirePermission, getEffectivePermissions } from "@/lib/permissionGuard";
import { HttpError } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";
import { createInvoiceFromQuotation } from "@/lib/crm/accounting";

/** Convert an accepted quotation into an accounting invoice (draft). */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-quotations", ["admin"]);
    const perms = await getEffectivePermissions(session.orgId as string, session.role);
    if (!perms.includes("invoices")) {
      throw new HttpError(403, "Accounting (invoicing) access is required to create an invoice");
    }
    const { id } = await ctx.params;
    try {
      const result = await createInvoiceFromQuotation(session, id);
      await recordAudit(session, {
        action: result.created ? "crm.quotation.convert" : "crm.quotation.convert_existing",
        module: "crm",
        summary: `Converted quotation ${id} to an accounting invoice`,
        targetType: "crmQuotation",
        targetId: id,
        metadata: { invoiceId: result.invoiceId },
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
