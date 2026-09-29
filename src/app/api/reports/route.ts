import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/**
 * Report data for admins and secretaries: leave requests, car logs, petty cash,
 * invoices and bills across the whole organisation. Clients filter by type,
 * date range and employee.
 */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("reports", ["admin", "secretary"]);
    try {
      const [leaves, car_logs, petty_cash, invoices, bills, tasks, visitors, asset_movements] = await Promise.all([
        cx().query(api.leaves.listLeaves, {
          secret: secret(),
          orgId: session.orgId as never,
          userId: null as never,
        }),
        cx().query(api.carLogs.listCarLogs, {
          secret: secret(),
          orgId: session.orgId as never,
        }),
        cx().query(api.pettyCash.listPettyCash, {
          secret: secret(),
          orgId: session.orgId as never,
          userId: null as never,
        }),
        cx().query(api.invoicing.listInvoices, {
          secret: secret(),
          orgId: session.orgId as never,
        }),
        cx().query(api.bills.listBills, {
          secret: secret(),
          orgId: session.orgId as never,
        }),
        cx().query(api.tasks.reportTasks, {
          secret: secret(),
          orgId: session.orgId as never,
        }),
        cx().query(api.visitors.listVisitors, {
          secret: secret(),
          orgId: session.orgId as never,
          viewerId: session.id as never,
        }),
        cx().query(api.assets.listAssetMovements, {
          secret: secret(),
          orgId: session.orgId as never,
        }),
      ]);
      return ok({ leaves, car_logs, petty_cash, invoices, bills, tasks, visitors, asset_movements });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}