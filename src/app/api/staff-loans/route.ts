import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** List staff loans / advances. Admin only. */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("payroll", ["admin"]);
    try {
      const loans = await cx().query(api.payroll.listStaffLoans, {
        secret: secret(),
        orgId: session.orgId as never,
      });
      return ok({ loans });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Create a staff loan / advance. Admin only. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("payroll", ["admin"]);
    const body = await readJson<{
      userId: string;
      kind: "loan" | "advance";
      principal: number;
      monthlyDeduction: number;
      description?: string;
    }>(req);
    requireFields(body, ["userId", "principal", "monthlyDeduction"]);

    const principal = Number(body.principal);
    const monthlyDeduction = Number(body.monthlyDeduction);
    if (!Number.isFinite(principal) || principal <= 0) throw new HttpError(400, "Enter a valid amount");
    if (!Number.isFinite(monthlyDeduction) || monthlyDeduction <= 0) {
      throw new HttpError(400, "Enter a valid monthly recovery amount");
    }

    try {
      const id = await cx().mutation(api.payroll.createStaffLoan, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: body.userId as never,
        kind: body.kind === "advance" ? "advance" : "loan",
        principal,
        monthlyDeduction,
        description: body.description?.trim() || undefined,
      });
      return ok({ id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
