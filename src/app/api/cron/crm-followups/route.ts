import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/api";
import { cronAuthorized } from "@/lib/cronAuth";
import { cx, secret, api } from "@/lib/convex";

export const maxDuration = 60;

function envNum(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function run(req: NextRequest) {
  return handle(async () => {
    if (!cronAuthorized(req)) return fail(401, "Unauthorized");

    const orgs = (await cx().query(api.crmAutomation.listAutomationOrgs, {
      secret: secret(),
    })) as Array<{ id: string }>;

    const thresholds = {
      staleLeadDays: envNum("CRM_STALE_LEAD_DAYS", 3),
      staleDealDays: envNum("CRM_STALE_DEAL_DAYS", 7),
      slaHours: envNum("CRM_LEAD_SLA_HOURS", 24),
      quoteFollowUpDays: envNum("CRM_QUOTE_FOLLOWUP_DAYS", 3),
    };

    let leads = 0;
    let deals = 0;
    let quotes = 0;
    let notifications = 0;
    let failed = 0;

    for (const org of orgs) {
      try {
        const result = await cx().mutation(api.crmAutomation.runForOrg, {
          secret: secret(),
          orgId: org.id as never,
          now: Date.now(),
          ...thresholds,
        });
        leads += result.leads;
        deals += result.deals;
        quotes += result.quotes;
        notifications += result.notifications;
      } catch {
        failed += 1;
      }
    }

    return ok({
      orgs: orgs.length,
      failed,
      tasks: { leads, deals, quotes },
      notifications,
    });
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
