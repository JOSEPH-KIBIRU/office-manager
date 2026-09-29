import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields, amountInRange } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Monthly petty-cash allocation vs spend. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("petty-cash", ["admin", "secretary", "manager", "employee"]);
    const period = new URL(req.url).searchParams.get("period");
    if (!period || !/^\d{4}-\d{2}$/.test(period)) throw new HttpError(400, "A month (YYYY-MM) is required");
    try {
      const data = await cx().query(api.pettyCash.getBudget, {
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

/** Set the monthly allocation (admin/secretary). Funds the float in the ledger. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("petty-cash", ["admin", "secretary"]);
    const body = await readJson<{ period: string; amount: number }>(req);
    requireFields(body, ["period", "amount"]);
    if (!/^\d{4}-\d{2}$/.test(String(body.period))) throw new HttpError(400, "A month (YYYY-MM) is required");
    const amount = amountInRange(body.amount, "Amount", 0, 100_000_000);
    try {
      const id = await cx().mutation(api.pettyCash.setBudget, {
        secret: secret(),
        orgId: session.orgId as never,
        period: String(body.period),
        amount,
        userId: session.id as never,
      });
      return ok({ id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
