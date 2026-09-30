import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Current user's own payslips (any logged-in employee). */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("my-payslips", ["admin", "secretary", "manager", "employee"]);
    let payslips;
    try {
      payslips = await cx().query(api.payroll.listMyPayslips, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: session.id as never,
      });
    } catch (e) {
      return mapConvexError(e);
    }
    return ok({ payslips });
  });
}
