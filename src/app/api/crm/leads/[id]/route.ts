import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-leads", ["admin"]);
    const { id } = await ctx.params;
    try {
      const lead = await cx().query(api.crmLeads.getLead, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
      return ok({ lead });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-leads", ["admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      companyName?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      source?: string;
      ownerId?: string | null;
      value?: number | null;
      notes?: string;
      status?: "new" | "contacted" | "qualified" | "disqualified" | "converted";
    }>(req);
    try {
      await cx().mutation(api.crmLeads.updateLead, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
        companyName: body.companyName,
        contactName: body.contactName,
        email: body.email,
        phone: body.phone,
        source: body.source,
        ownerId: body.ownerId as never,
        value: body.value,
        notes: body.notes,
        status: body.status as never,
      });
      await recordAudit(session, {
        action: "crm.lead.update",
        module: "crm",
        summary: `Updated lead ${id}`,
        targetType: "crmLead",
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
    const session = await requirePermission("crm-leads", ["admin"]);
    const { id } = await ctx.params;
    try {
      await cx().mutation(api.crmLeads.deleteLead, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
      });
      await recordAudit(session, {
        action: "crm.lead.delete",
        module: "crm",
        summary: `Deleted lead ${id}`,
        targetType: "crmLead",
        targetId: id,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
