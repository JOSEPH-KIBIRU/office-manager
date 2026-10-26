import { NextRequest } from "next/server";
import { requirePermission, getEffectivePermissions } from "@/lib/permissionGuard";
import { HttpError } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";
import { ensureCustomerForCompany } from "@/lib/crm/accounting";

/**
 * Promote a CRM company into an authoritative accounting customer.
 * Requires CRM companies access *and* invoicing access (accounting must be part
 * of the tenant's plan); the write goes through the invoicing module.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-companies", ["admin"]);
    const perms = await getEffectivePermissions(session.orgId as string, session.role);
    if (!perms.includes("invoices")) {
      throw new HttpError(403, "Accounting (invoicing) access is required to create a customer");
    }
    const { id } = await ctx.params;
    try {
      const result = await ensureCustomerForCompany(session, id);
      await recordAudit(session, {
        action: result.created ? "crm.company.promote" : "crm.company.promote_existing",
        module: "crm",
        summary: result.created
          ? `Created accounting customer for company ${id}`
          : `Company ${id} was already linked to an accounting customer`,
        targetType: "crmCompany",
        targetId: id,
        metadata: { contactId: result.contactId },
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
