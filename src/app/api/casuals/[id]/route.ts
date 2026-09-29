import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Update a casual worker. Admin only. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      name?: string;
      phone?: string;
      idNumber?: string;
      dailyRate?: number;
      active?: boolean;
    }>(req);

    if (body.dailyRate !== undefined && (!Number.isFinite(body.dailyRate) || body.dailyRate < 0)) {
      throw new HttpError(400, "Enter a valid daily rate");
    }

    try {
      const res = await cx().mutation(api.payroll.updateCasual, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        name: body.name,
        phone: body.phone,
        idNumber: body.idNumber,
        dailyRate: body.dailyRate,
        active: body.active,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Delete a casual worker. Admin only. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const { id } = await ctx.params;
    try {
      const res = await cx().mutation(api.payroll.deleteCasual, {
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
