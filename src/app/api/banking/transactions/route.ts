import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** GET /api/banking/transactions?accountCode=&onlyUnreconciled= */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const url = new URL(req.url);
    const rows = await cx().query(api.banking.listTransactions, {
      secret: secret(),
      orgId: session.orgId as never,
      accountCode: url.searchParams.get("accountCode") || undefined,
      onlyUnreconciled: url.searchParams.get("onlyUnreconciled") === "1",
    });
    return ok({ transactions: rows });
  });
}

/** POST /api/banking/transactions — record a manual bank movement. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const body = await readJson<{
      accountCode: string;
      bankAccountId?: string;
      date: string;
      description: string;
      amount: number;
      reference?: string;
      counterAccountCode?: string;
      source?: string;
    }>(req);
    requireFields(body, ["accountCode", "date", "description", "amount"]);
    try {
      const res = await cx().mutation(api.banking.createManualTransaction, {
        secret: secret(),
        orgId: session.orgId as never,
        accountCode: body.accountCode,
        bankAccountId: body.bankAccountId as never,
        date: String(body.date),
        description: String(body.description),
        amount: Number(body.amount),
        reference: body.reference,
        counterAccountCode: body.counterAccountCode,
        source: body.source,
      });
      await recordAudit(session, { action: "banking.transaction", module: "banking", summary: `Recorded bank transaction ${body.description}` });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
