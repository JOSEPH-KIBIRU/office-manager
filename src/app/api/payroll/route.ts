import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export async function GET() {
  return handle(async () => {
    const session = await requirePermission("payroll", ["admin"]);
    let payrolls;
    try {
      payrolls = await cx().query(api.payroll.listPayrolls, {
        secret: secret(),
        orgId: session.orgId as never,
      });
    } catch (e) {
      return mapConvexError(e);
    }
    return ok({ payrolls });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("payroll", ["admin"]);
    const body = await readJson<{
      month: number;
      year: number;
      employeeIds?: string[];
      allowances?: Array<{ userId: string; amount: number }>;
      perDiems?: Array<{ userId: string; amount: number }>;
      overtime?: Array<{ userId: string; hours: number; rate: number }>;
      bonuses?: Array<{ userId: string; amount: number }>;
      otherDeductions?: Array<{ userId: string; amount: number }>;
      leaveDaysPayouts?: Array<{ userId: string; amount: number }>;
      casuals?: Array<{ casualId: string; days: number; statutory: boolean; perDiem?: number }>;
      encashmentIds?: string[];
      costCenterCode?: string;
      projectId?: string;
    }>(req);
    requireFields(body, ["month", "year"]);
    const month = Number(body.month);
    const year = Number(body.year);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new HttpError(400, "Invalid month");
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new HttpError(400, "Invalid year");
    }

    try {
      const result = await cx().mutation(api.payroll.runPayroll, {
        secret: secret(),
        orgId: session.orgId as never,
        runBy: session.id as never,
        month,
        year,
        employeeIds: body.employeeIds as never,
        allowances: body.allowances as never,
        perDiems: body.perDiems as never,
        overtime: body.overtime as never,
        bonuses: body.bonuses as never,
        otherDeductions: body.otherDeductions as never,
        leaveDaysPayouts: body.leaveDaysPayouts as never,
        casuals: body.casuals as never,
        encashmentIds: body.encashmentIds as never,
        costCenterCode: body.costCenterCode,
        projectId: body.projectId as never,
      });
      await recordAudit(session, {
        action: "payroll.run",
        module: "payroll",
        summary: `Ran payroll for ${month}/${year}`,
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
