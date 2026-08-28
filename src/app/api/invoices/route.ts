import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser(["admin", "manager", "secretary"]);
    const rows = await cx().query(api.invoicing.listInvoices, {
      secret: secret(),
      orgId: session.orgId as never,
    });
    return ok({ invoices: rows });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser(["admin", "manager", "secretary"]);
    const body = await readJson<{
      contactId: string;
      issueDate: string;
      dueDate: string;
      lineItems: Array<{ description: string; qty: number; unitPrice: number; taxRate: number }>;
      note?: string;
      recurringFrequency?: "weekly" | "monthly" | "quarterly" | "yearly";
      recurringActive?: boolean;
    }>(req);
    if (!body.contactId || !body.issueDate || !body.dueDate) {
      throw new Error("Contact, issue date and due date are required");
    }
    if (!Array.isArray(body.lineItems) || body.lineItems.length === 0) {
      throw new Error("Add at least one line item");
    }
    try {
      const id = await cx().mutation(api.invoicing.createInvoice, {
        secret: secret(),
        orgId: session.orgId as never,
        contactId: body.contactId as never,
        issueDate: body.issueDate,
        dueDate: body.dueDate,
        lineItems: body.lineItems,
        note: body.note ?? undefined,
        recurringFrequency: body.recurringFrequency as never,
        recurringActive: body.recurringActive ?? false,
        createdBy: session.id as never,
      });
      return ok({ id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
