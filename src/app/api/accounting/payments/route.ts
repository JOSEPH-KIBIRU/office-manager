import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** GET /api/accounting/payments?contactId= — supplier payments (money out). */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("payments", ["admin", "secretary", "manager"]);
    const contactId = new URL(req.url).searchParams.get("contactId") || undefined;
    const rows = await cx().query(api.subledger.listPayments, {
      secret: secret(),
      orgId: session.orgId as never,
      kind: "payment",
      contactId: contactId as never,
    });
    return ok({ payments: rows });
  });
}

/** POST /api/accounting/payments — record a supplier payment and apply it to bills. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const body = await readJson<{
      contactId: string;
      date: string;
      amount: number;
      method: "bank" | "mpesa" | "cash";
      reference?: string;
      notes?: string;
      allocations?: Array<{ billId: string; amount: number }>;
    }>(req);
    requireFields(body, ["contactId", "date", "amount", "method"]);
    try {
      const res = await cx().mutation(api.subledger.createPayment, {
        secret: secret(),
        orgId: session.orgId as never,
        contactId: body.contactId as never,
        date: String(body.date),
        amount: Number(body.amount),
        method: body.method,
        reference: body.reference,
        notes: body.notes,
        allocations: (body.allocations ?? []).map((a) => ({
          billId: a.billId as never,
          amount: Number(a.amount),
        })),
        createdBy: session.id as never,
        createdByName: session.name,
      });
      await recordAudit(session, {
        action: "accounting.payment",
        module: "accounting",
        summary: `Recorded payment of KES ${Number(body.amount).toLocaleString("en-KE")}`,
        targetType: "contact",
        targetId: body.contactId,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
