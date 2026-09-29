import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, fail } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/**
 * Financial statements from the ledger.
 *   ?type=trial  → trial balance (through optional)
 *   ?type=pnl    → profit & loss (from, through)
 *   ?type=bs     → balance sheet (through)
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "trial";
    const from = url.searchParams.get("from") || undefined;
    const through = url.searchParams.get("through") || undefined;
    const today = new Date().toISOString().slice(0, 10);

    try {
      if (type === "trial") {
        const data = await cx().query(api.accounting.trialBalance, {
          secret: secret(),
          orgId: session.orgId as never,
          through,
        });
        return ok({ type, data });
      }
      if (type === "pnl") {
        const start = from || `${(through || today).slice(0, 4)}-01-01`;
        const end = through || today;
        const data = await cx().query(api.accounting.profitAndLoss, {
          secret: secret(),
          orgId: session.orgId as never,
          from: start,
          through: end,
        });
        return ok({ type, data });
      }
      if (type === "bs") {
        const data = await cx().query(api.accounting.balanceSheet, {
          secret: secret(),
          orgId: session.orgId as never,
          through: through || today,
        });
        return ok({ type, data });
      }
      return fail(400, "Unknown report type");
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
