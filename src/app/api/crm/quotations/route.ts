import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("crm-quotations", ["admin"]);
    const p = new URL(req.url).searchParams;
    try {
      const quotations = await cx().query(api.crmQuotations.listQuotations, {
        secret: secret(),
        orgId: session.orgId as never,
        status: (p.get("status") ?? undefined) as never,
        companyId: (p.get("companyId") ?? undefined) as never,
        dealId: (p.get("dealId") ?? undefined) as never,
      });
      return ok({ quotations });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("crm-quotations", ["admin"]);
    const body = await readJson<{
      companyId?: string;
      contactId?: string;
      dealId?: string;
      issueDate: string;
      validUntil?: string;
      currency?: string;
      notes?: string;
      terms?: string;
      items: Array<{ description: string; qty: number; unitPrice: number; taxRate: number }>;
    }>(req);
    requireFields(body, ["issueDate"]);
    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new HttpError(400, "Add at least one line item");
    }
    try {
      const result = await cx().mutation(api.crmQuotations.createQuotation, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        companyId: body.companyId as never,
        contactId: body.contactId as never,
        dealId: body.dealId as never,
        issueDate: String(body.issueDate),
        validUntil: body.validUntil,
        currency: body.currency,
        notes: body.notes,
        terms: body.terms,
        items: body.items,
      });
      await recordAudit(session, {
        action: "crm.quotation.create",
        module: "crm",
        summary: `Created quotation ${result.number}`,
        targetType: "crmQuotation",
        targetId: String(result.id),
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
