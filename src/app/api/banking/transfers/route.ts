import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** GET /api/banking/transfers */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const transfers = await cx().query(api.banking.listTransfers, { secret: secret(), orgId: session.orgId as never });
    return ok({ transfers });
  });
}

/** POST /api/banking/transfers — move money between two own accounts (never income/expense). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const body = await readJson<{
      date: string;
      fromAccountCode: string;
      toAccountCode: string;
      amount: number;
      reference?: string;
      notes?: string;
    }>(req);
    requireFields(body, ["date", "fromAccountCode", "toAccountCode", "amount"]);
    try {
      const res = await cx().mutation(api.banking.createTransfer, {
        secret: secret(),
        orgId: session.orgId as never,
        date: String(body.date),
        fromAccountCode: body.fromAccountCode,
        toAccountCode: body.toAccountCode,
        amount: Number(body.amount),
        reference: body.reference,
        notes: body.notes,
        createdBy: session.id as never,
        createdByName: session.name,
      });
      await recordAudit(session, {
        action: "banking.transfer",
        module: "banking",
        summary: `Transferred KES ${Number(body.amount).toLocaleString("en-KE")} from ${body.fromAccountCode} to ${body.toAccountCode}`,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
