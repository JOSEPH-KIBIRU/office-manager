import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { notifyUser, escapeHtml } from "@/lib/notify";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("cars", ["admin", "manager"]);
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
        await requirePermission("car-approve", ["admin"]);
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
          `<p>Your ${escapeHtml(row.category)} entry for <strong>${escapeHtml(row.vehicle_reg)}</strong> (${escapeHtml(row.requisition_no)}) has been <strong>${escapeHtml(status.toUpperCase())}</strong>.</p>${body.note ? `<p>Note: ${escapeHtml(body.note)}</p>` : ""}`,
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
    const session = await requirePermission("cars", ["admin", "manager"]);
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
