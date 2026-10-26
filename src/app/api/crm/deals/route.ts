import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("crm-pipeline", ["admin"]);
    const p = new URL(req.url).searchParams;
    try {
      const deals = await cx().query(api.crmDeals.listDeals, {
        secret: secret(),
        orgId: session.orgId as never,
        pipelineId: (p.get("pipelineId") ?? undefined) as never,
        stageId: (p.get("stageId") ?? undefined) as never,
        companyId: (p.get("companyId") ?? undefined) as never,
        status: (p.get("status") ?? undefined) as never,
      });
      return ok({ deals });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("crm-pipeline", ["admin"]);
    const body = await readJson<{
      pipelineId: string;
      stageId: string;
      title: string;
      value: number;
      currency?: string;
      expectedCloseDate?: string;
      companyId?: string;
      contactId?: string;
      leadId?: string;
      ownerId?: string;
      notes?: string;
    }>(req);
    requireFields(body, ["pipelineId", "stageId", "title", "value"]);
    try {
      const id = await cx().mutation(api.crmDeals.createDeal, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        pipelineId: body.pipelineId as never,
        stageId: body.stageId as never,
        title: String(body.title),
        value: Number(body.value),
        currency: body.currency,
        expectedCloseDate: body.expectedCloseDate,
        companyId: body.companyId as never,
        contactId: body.contactId as never,
        leadId: body.leadId as never,
        ownerId: body.ownerId as never,
        notes: body.notes,
      });
      await recordAudit(session, {
        action: "crm.deal.create",
        module: "crm",
        summary: `Created deal "${body.title}"`,
        targetType: "crmDeal",
        targetId: String(id),
      });
      return ok({ id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
