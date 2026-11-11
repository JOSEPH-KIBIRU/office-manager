import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { scoreLeadById } from "@/lib/crmLeadAi";
import { recordAudit } from "@/lib/audit";

export const maxDuration = 60;

/** Re-score one lead with AI. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-leads", ["admin"]);
    const { id } = await ctx.params;
    const result = await scoreLeadById(session.orgId as string, id);
    await recordAudit(session, {
      action: "crm.lead.ai_score",
      module: "crm",
      summary: `AI scored lead ${id}`,
      targetType: "crmLead",
      targetId: id,
      metadata: { score: result.score },
    });
    return ok(result);
  });
}
