import { NextRequest } from "next/server";
import { requirePermission, getEffectivePermissions } from "@/lib/permissionGuard";
import { HttpError } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** Create a CRM lead from an inbound email. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-email", ["admin"]);
    const perms = await getEffectivePermissions(session.orgId as string, session.role);
    if (!perms.includes("crm-leads")) {
      throw new HttpError(403, "CRM leads access is required to create a lead");
    }
    const { id } = await ctx.params;
    try {
      const result = await cx().mutation(api.crmEmail.convertToLead, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
      });
      await recordAudit(session, {
        action: result.created ? "crm.email.create_lead" : "crm.email.link_existing_lead",
        module: "crm",
        summary: result.created ? `Created lead from email ${id}` : `Linked email ${id} to an existing lead`,
        targetType: "crmEmailMessage",
        targetId: id,
        metadata: { leadId: result.leadId },
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
