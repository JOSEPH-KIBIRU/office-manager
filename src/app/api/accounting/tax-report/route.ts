import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/**
 * GET /api/accounting/tax-report?type=vat|summary&from=YYYY-MM-DD&through=YYYY-MM-DD
 * All figures derive from the General Ledger.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "vat";
    const today = new Date().toISOString().slice(0, 10);
    const from = url.searchParams.get("from") || `${today.slice(0, 4)}-01-01`;
    const through = url.searchParams.get("through") || today;
    try {
      if (type === "summary") {
        const data = await cx().query(api.tax.taxSummary, { secret: secret(), orgId: session.orgId as never, from, through });
        return ok(data);
      }
      const data = await cx().query(api.tax.vatReport, { secret: secret(), orgId: session.orgId as never, from, through });
      return ok(data);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      return mapConvexError(e);
    }
  });
}
