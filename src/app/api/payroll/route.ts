import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET() {
  return handle(async () => {
    const session = await requireUser(["admin"]);
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
    const session = await requireUser(["admin"]);
    const body = await readJson<{
      month: number;
      year: number;
      employeeIds?: string[];
      allowances?: Array<{ userId: string; amount: number }>;
      leaveDaysPayouts?: Array<{ userId: string; amount: number }>;
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
        leaveDaysPayouts: body.leaveDaysPayouts as never,
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
