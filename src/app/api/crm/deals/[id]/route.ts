import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-pipeline", ["admin"]);
    const { id } = await ctx.params;
    try {
      const deal = await cx().query(api.crmDeals.getDeal, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
      return ok({ deal });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-pipeline", ["admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      pipelineId?: string;
      stageId?: string;
      title?: string;
      value?: number;
      currency?: string;
      expectedCloseDate?: string | null;
      companyId?: string | null;
      contactId?: string | null;
      leadId?: string | null;
      ownerId?: string | null;
      status?: "open" | "won" | "lost";
      lostReason?: string;
      notes?: string;
    }>(req);
    try {
      await cx().mutation(api.crmDeals.updateDeal, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
        pipelineId: body.pipelineId as never,
        stageId: body.stageId as never,
        title: body.title,
        value: body.value,
        currency: body.currency,
        expectedCloseDate: body.expectedCloseDate as never,
        companyId: body.companyId as never,
        contactId: body.contactId as never,
        leadId: body.leadId as never,
        ownerId: body.ownerId as never,
        status: body.status as never,
        lostReason: body.lostReason,
        notes: body.notes,
      });
      await recordAudit(session, {
        action: "crm.deal.update",
        module: "crm",
        summary: `Updated deal ${id}`,
        targetType: "crmDeal",
        targetId: id,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-pipeline", ["admin"]);
    const { id } = await ctx.params;
    try {
      await cx().mutation(api.crmDeals.deleteDeal, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
      });
      await recordAudit(session, {
        action: "crm.deal.delete",
        module: "crm",
        summary: `Deleted deal ${id}`,
        targetType: "crmDeal",
        targetId: id,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
