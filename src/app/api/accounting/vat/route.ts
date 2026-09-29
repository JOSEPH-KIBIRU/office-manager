import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** VAT return (VAT3 working paper) for a period (YYYY-MM). */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const period = new URL(req.url).searchParams.get("period");
    if (!period || !/^\d{4}-\d{2}$/.test(period)) throw new HttpError(400, "A period (YYYY-MM) is required");
    try {
      const data = await cx().query(api.accounting.vatReturn, {
        secret: secret(),
        orgId: session.orgId as never,
        period,
      });
      return ok(data);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
