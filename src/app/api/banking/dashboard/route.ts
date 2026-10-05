import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api } from "@/lib/convex";

/** GET /api/banking/dashboard — cash/bank/M-Pesa totals and reconciliation status. */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const data = await cx().query(api.banking.dashboard, { secret: secret(), orgId: session.orgId as never });
    return ok(data);
  });
}
