import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Admin only: full payslip breakdown for a payroll run, plus all rows. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const { id } = await ctx.params;
    let data;
    try {
      data = await cx().query(api.payroll.listMonthlyPayslips, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
    } catch (e) {
      return mapConvexError(e);
    }
    return ok(data);
  });
}

/** Admin only: edit a payroll run (recalculates payslips). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      basicSalaries?: Array<{ userId: string; amount: number }>;
      allowances?: Array<{ userId: string; amount: number }>;
      perDiems?: Array<{ userId: string; amount: number }>;
      overtime?: Array<{ userId: string; hours: number; rate: number }>;
      overtimeAmounts?: Array<{ userId: string; amount: number }>;
      bonuses?: Array<{ userId: string; amount: number }>;
      otherDeductions?: Array<{ userId: string; amount: number }>;
      leaveDaysPayouts?: Array<{ userId: string; amount: number }>;
      helbDeductions?: Array<{ userId: string; amount: number }>;
      casualDays?: Array<{ casualId: string; days: number }>;
      paid?: boolean;
      paymentMethod?: string;
    }>(req);

    if (body.paid !== undefined) {
      try {
        const result = await cx().mutation(api.payroll.markPayrollPaid, {
          secret: secret(),
          orgId: session.orgId as never,
          id: id as never,
          paid: body.paid,
          paidBy: session.id as never,
          method: body.paymentMethod,
        });
        return ok(result);
      } catch (e) {
        return mapConvexError(e);
      }
    }

    try {
      const result = await cx().mutation(api.payroll.updatePayroll, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        basicSalaries: body.basicSalaries as never,
        allowances: body.allowances as never,
        perDiems: body.perDiems as never,
        overtime: body.overtime as never,
        overtimeAmounts: body.overtimeAmounts as never,
        bonuses: body.bonuses as never,
        otherDeductions: body.otherDeductions as never,
        leaveDaysPayouts: body.leaveDaysPayouts as never,
        helbDeductions: body.helbDeductions as never,
        casualDays: body.casualDays as never,
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Admin only: delete a payroll run. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const { id } = await ctx.params;
    try {
      const result = await cx().mutation(api.payroll.deletePayroll, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
