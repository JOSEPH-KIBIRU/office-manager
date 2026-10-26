import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** Convert a qualified lead into a company/contact + an open deal. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-leads", ["admin"]);
    const { id } = await ctx.params;
    try {
      const result = await cx().mutation(api.crmLeads.convertLead, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
      });
      await recordAudit(session, {
        action: "crm.lead.convert",
        module: "crm",
        summary: `Converted lead ${id} into a deal`,
        targetType: "crmLead",
        targetId: id,
        metadata: result,
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
