import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** GET /api/accounting/credit-notes?kind=sales_credit|purchase_debit */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const kind = new URL(req.url).searchParams.get("kind") || undefined;
    const rows = await cx().query(api.subledger.listCreditNotes, {
      secret: secret(),
      orgId: session.orgId as never,
      kind,
    });
    return ok({ creditNotes: rows });
  });
}

/** POST /api/accounting/credit-notes — create (and optionally issue) a credit/debit note. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const body = await readJson<{
      contactId: string;
      kind: "sales_credit" | "purchase_debit";
      issueDate: string;
      amount: number;
      taxRate?: number;
      reason?: string;
      allocateToInvoiceId?: string;
      allocateToBillId?: string;
    }>(req);
    requireFields(body, ["contactId", "kind", "issueDate", "amount"]);
    try {
      const res = await cx().mutation(api.subledger.createCreditNote, {
        secret: secret(),
        orgId: session.orgId as never,
        contactId: body.contactId as never,
        kind: body.kind,
        issueDate: String(body.issueDate),
        amount: Number(body.amount),
        taxRate: body.taxRate !== undefined ? Number(body.taxRate) : undefined,
        reason: body.reason,
        allocateToInvoiceId: body.allocateToInvoiceId as never,
        allocateToBillId: body.allocateToBillId as never,
        createdBy: session.id as never,
        createdByName: session.name,
      });
      await recordAudit(session, {
        action: "accounting.credit_note",
        module: "accounting",
        summary: `Created ${body.kind === "sales_credit" ? "credit" : "debit"} note ${res.number}`,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
