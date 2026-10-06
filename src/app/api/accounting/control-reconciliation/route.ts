import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api } from "@/lib/convex";

/** GET /api/accounting/control-reconciliation — GL AR/AP vs sub-ledger open items. */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const data = await cx().query(api.subledger.controlReconciliation, { secret: secret(), orgId: session.orgId as never });
    return ok(data);
  });
}
