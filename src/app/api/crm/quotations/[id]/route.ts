import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-quotations", ["admin"]);
    const { id } = await ctx.params;
    try {
      const quotation = await cx().query(api.crmQuotations.getQuotation, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
      return ok({ quotation });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-quotations", ["admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      companyId?: string | null;
      contactId?: string | null;
      dealId?: string | null;
      issueDate?: string;
      validUntil?: string | null;
      currency?: string;
      notes?: string;
      terms?: string;
      items?: Array<{ description: string; qty: number; unitPrice: number; taxRate: number }>;
    }>(req);
    try {
      await cx().mutation(api.crmQuotations.updateQuotation, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
        companyId: body.companyId as never,
        contactId: body.contactId as never,
        dealId: body.dealId as never,
        issueDate: body.issueDate,
        validUntil: body.validUntil as never,
        currency: body.currency,
        notes: body.notes,
        terms: body.terms,
        items: body.items,
      });
      await recordAudit(session, {
        action: "crm.quotation.update",
        module: "crm",
        summary: `Updated quotation ${id}`,
        targetType: "crmQuotation",
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
    const session = await requirePermission("crm-quotations", ["admin"]);
    const { id } = await ctx.params;
    try {
      await cx().mutation(api.crmQuotations.deleteQuotation, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
      });
      await recordAudit(session, {
        action: "crm.quotation.delete",
        module: "crm",
        summary: `Deleted quotation ${id}`,
        targetType: "crmQuotation",
        targetId: id,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
