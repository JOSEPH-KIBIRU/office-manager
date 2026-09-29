import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Update a staff loan / advance. Admin only. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      monthlyDeduction?: number;
      balance?: number;
      description?: string;
      active?: boolean;
    }>(req);

    if (body.monthlyDeduction !== undefined && (!Number.isFinite(body.monthlyDeduction) || body.monthlyDeduction <= 0)) {
      throw new HttpError(400, "Enter a valid monthly recovery amount");
    }
    if (body.balance !== undefined && (!Number.isFinite(body.balance) || body.balance < 0)) {
      throw new HttpError(400, "Enter a valid balance");
    }

    try {
      const res = await cx().mutation(api.payroll.updateStaffLoan, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        monthlyDeduction: body.monthlyDeduction,
        balance: body.balance,
        description: body.description,
        active: body.active,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Delete a staff loan / advance. Admin only. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const { id } = await ctx.params;
    try {
      const res = await cx().mutation(api.payroll.deleteStaffLoan, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
