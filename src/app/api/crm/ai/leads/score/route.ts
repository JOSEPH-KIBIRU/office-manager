import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { scoreLeadById, scoreUnscoredLeads } from "@/lib/crmLeadAi";
import { recordAudit } from "@/lib/audit";

export const maxDuration = 60;

/** Score all unscored leads (or a specific list of lead ids) with AI. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("crm-leads", ["admin"]);
    const body = (await readJson<{ ids?: string[]; limit?: number }>(req).catch(() => ({}))) as {
      ids?: string[];
      limit?: number;
    };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string").slice(0, 10)
      : [];

    let result;
    if (ids.length > 0) {
      const leads = [];
      for (const id of ids) {
        leads.push(await scoreLeadById(session.orgId as string, id));
      }
      result = { requested: ids.length, scored: leads.length, leads };
    } else {
      const limit = Math.min(Math.max(Number(body.limit ?? 5), 1), 10);
      result = await scoreUnscoredLeads(session.orgId as string, limit);
    }

    await recordAudit(session, {
      action: "crm.lead.ai_score",
      module: "crm",
      summary: `AI scored ${result.scored} lead(s)`,
      metadata: { scored: result.scored },
    });
    return ok(result);
  });
}
