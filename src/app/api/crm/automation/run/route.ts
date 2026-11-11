import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export const maxDuration = 60;

function envNum(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Run stale-lead/deal, quote and SLA follow-up automation for the current org. */
export async function POST() {
  return handle(async () => {
    const session = await requirePermission("crm", ["admin"]);
    const result = await cx().mutation(api.crmAutomation.runForOrg, {
      secret: secret(),
      orgId: session.orgId as never,
      now: Date.now(),
      staleLeadDays: envNum("CRM_STALE_LEAD_DAYS", 3),
      staleDealDays: envNum("CRM_STALE_DEAL_DAYS", 7),
      slaHours: envNum("CRM_LEAD_SLA_HOURS", 24),
      quoteFollowUpDays: envNum("CRM_QUOTE_FOLLOWUP_DAYS", 3),
    });
    await recordAudit(session, {
      action: "crm.automation.run",
      module: "crm",
      summary: `Follow-up automation created ${result.leads} lead, ${result.deals} deal and ${result.quotes} quote task(s)`,
      metadata: result,
    });
    return ok(result);
  });
}
