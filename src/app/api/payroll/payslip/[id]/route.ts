import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/**
 * Fetch a single payslip. Admins can fetch any payslip in their org; other
 * employees can only fetch their own (payslip record userId === session.id).
 * URL: /api/payroll/payslip/[payrollId]?userId=<optional>
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["admin", "secretary", "manager", "employee"]);
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const requestedUserId = url.searchParams.get("userId");

    let row;
    try {
      row = await cx().query(api.payroll.getPayslip, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        admin: session.role === "admin" && !!requestedUserId,
        userId: (session.role === "admin" && requestedUserId ? requestedUserId : session.id) as never,
      });
    } catch (e) {
      return mapConvexError(e);
    }
    return ok(row);
  });
}

