import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/**
 * GET  /api/banking/reconcile?accountCode=&statementClosingBalance=
 * POST /api/banking/reconcile — complete a reconciliation.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const url = new URL(req.url);
    const accountCode = url.searchParams.get("accountCode");
    if (!accountCode) throw new HttpError(400, "accountCode is required");
    const summary = await cx().query(api.banking.reconciliationSummary, {
      secret: secret(),
      orgId: session.orgId as never,
      accountCode,
      statementClosingBalance: Number(url.searchParams.get("statementClosingBalance") || 0),
    });
    return ok({ summary });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const body = await readJson<{
      accountCode: string;
      bankAccountId?: string;
      periodEnd: string;
      statementClosingBalance: number;
      force?: boolean;
      adjustmentAccountCode?: string;
    }>(req);
    if (!body.accountCode || !body.periodEnd) throw new HttpError(400, "accountCode and periodEnd are required");
    try {
      const res = await cx().mutation(api.banking.completeReconciliation, {
        secret: secret(),
        orgId: session.orgId as never,
        accountCode: body.accountCode,
        bankAccountId: body.bankAccountId as never,
        periodEnd: String(body.periodEnd),
        statementClosingBalance: Number(body.statementClosingBalance || 0),
        force: body.force,
        adjustmentAccountCode: body.adjustmentAccountCode,
        completedBy: session.id as never,
        completedByName: session.name,
      });
      await recordAudit(session, {
        action: "banking.reconcile",
        module: "banking",
        summary: `Completed reconciliation for ${body.accountCode} as at ${body.periodEnd}`,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
