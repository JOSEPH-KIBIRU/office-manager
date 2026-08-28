import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { notifyUser } from "@/lib/notify";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["admin", "manager"]);
    const { id } = await ctx.params;

    const row = await cx().query(api.carLogs.getCarLog, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
    });
    if (!row) throw new HttpError(404, "Car log not found");

    const body = await readJson<{
      action?: "approve" | "reject";
      vehicle_reg?: string;
      category?: string;
      description?: string;
      vendor?: string;
      amount?: number;
      log_date?: string;
      note?: string;
    }>(req);

    try {
      if (body.action) {
        if (session.role !== "admin") throw new HttpError(403, "Only the admin can approve or reject");
        await cx().mutation(api.carLogs.updateCarLog, {
          secret: secret(),
          orgId: session.orgId as never,
          id: id as never,
          action: body.action,
          reviewerId: session.id as never,
          note: body.note ?? undefined,
        });

        const status = body.action === "approve" ? "approved" : "rejected";
        await notifyUser(
          session.orgId,
          row.requested_by,
          `Car Log ${status === "approved" ? "Approved" : "Rejected"}`,
          `<p>Your ${row.category} entry for <strong>${row.vehicle_reg}</strong> (${row.requisition_no}) has been <strong>${status.toUpperCase()}</strong>.</p>${body.note ? `<p>Note: ${body.note}</p>` : ""}`,
          `Car log ${row.requisition_no} for ${row.vehicle_reg} was ${status}.${body.note ? " Note: " + body.note : ""}`
        );
      } else {
        await cx().mutation(api.carLogs.updateCarLog, {
          secret: secret(),
          orgId: session.orgId as never,
          id: id as never,
          vehicleReg: body.vehicle_reg?.toUpperCase().trim(),
          category: body.category,
          description: body.description?.trim(),
          vendor: body.vendor?.trim(),
          amount: body.amount !== undefined ? Number(body.amount) : undefined,
          logDate: body.log_date,
        });
      }
    } catch (e) {
      if (e instanceof HttpError) throw e;
      return mapConvexError(e);
    }

    const updated = await cx().query(api.carLogs.getCarLog, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
    });
    return ok({ carLog: updated });
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["admin", "manager"]);
    const { id } = await ctx.params;
    try {
      await cx().mutation(api.carLogs.deleteCarLog, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
      return ok();
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
