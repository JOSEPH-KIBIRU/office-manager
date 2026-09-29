import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("invoices", ["admin", "manager", "secretary"]);
    const { id } = await ctx.params;
    const row = await cx().query(api.invoicing.getInvoice, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
    });
    if (!row) throw new HttpError(404, "Invoice not found");
    return ok({ invoice: row });
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("invoices", ["admin", "manager", "secretary"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      contactId?: string;
      issueDate?: string;
      dueDate?: string;
      lineItems?: Array<{ description: string; qty: number; unitPrice: number; taxRate: number }>;
      note?: string;
      paymentDetails?: string;
      terms?: string;
      recurringFrequency?: "weekly" | "monthly" | "quarterly" | "yearly";
      recurringActive?: boolean;
    }>(req);
    try {
      await cx().mutation(api.invoicing.updateInvoice, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        contactId: body.contactId ? (body.contactId as never) : undefined,
        issueDate: body.issueDate,
        dueDate: body.dueDate,
        lineItems: body.lineItems,
        note: body.note,
        paymentDetails: body.paymentDetails,
        terms: body.terms,
        recurringFrequency: body.recurringFrequency as never,
        recurringActive: body.recurringActive,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("invoices", ["admin", "manager", "secretary"]);
    const { id } = await ctx.params;
    try {
      await cx().mutation(api.invoicing.deleteInvoice, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
