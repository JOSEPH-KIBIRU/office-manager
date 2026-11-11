import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { reviewInboundLeads } from "@/lib/crmLeadAi";
import { recordAudit } from "@/lib/audit";

export const maxDuration = 60;

/** Review unlinked inbound emails with AI and create/qualify leads. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("crm-email", ["admin"]);
    const body = await readJson<{ limit?: number }>(req).catch(() => ({ limit: undefined }));
    const limit = Math.min(Math.max(Number(body.limit ?? 8), 1), 15);
    const result = await reviewInboundLeads({
      orgId: session.orgId as string,
      actorId: session.id as string,
      limit,
    });
    await recordAudit(session, {
      action: "crm.lead.ai_review",
      module: "crm",
      summary: `AI reviewed ${result.reviewed} inbound email(s): ${result.created} new lead(s), ${result.linked} linked`,
      metadata: { reviewed: result.reviewed, created: result.created, linked: result.linked },
    });
    return ok(result);
  });
}
