import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/**
 * GET /api/management/reports?type=pnl-by-dimension|budget-vs-actual|project-profitability
 *   &from=YYYY-MM-DD&through=YYYY-MM-DD[&dimension=cost_centre|project]
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("management-reports", ["admin", "secretary", "manager"]);
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "pnl-by-dimension";
    const today = new Date().toISOString().slice(0, 10);
    const from = url.searchParams.get("from") || `${today.slice(0, 4)}-01-01`;
    const through = url.searchParams.get("through") || today;

    try {
      if (type === "budget-vs-actual") {
        const data = await cx().query(api.management.budgetVsActual, { secret: secret(), orgId: session.orgId as never, from, through });
        return ok(data);
      }
      if (type === "project-profitability") {
        const data = await cx().query(api.management.projectProfitability, { secret: secret(), orgId: session.orgId as never, from, through });
        return ok(data);
      }
      if (type === "cash-flow") {
        const data = await cx().query(api.management.cashFlowStatement, { secret: secret(), orgId: session.orgId as never, from, through });
        return ok(data);
      }
      if (type === "pnl-by-dimension") {
        const dimension = url.searchParams.get("dimension") === "project" ? "project" : "cost_centre";
        const data = await cx().query(api.management.pnlByDimension, { secret: secret(), orgId: session.orgId as never, dimension, from, through });
        return ok(data);
      }
      throw new HttpError(400, "Unknown report type");
    } catch (e) {
      if (e instanceof HttpError) throw e;
      return mapConvexError(e);
    }
  });
}
