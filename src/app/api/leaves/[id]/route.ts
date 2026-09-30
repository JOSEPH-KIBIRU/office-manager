import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { notifyLeaveDecision } from "@/lib/notify";
import { LEAVE_TYPES } from "@/lib/types";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { queueCalendarSync } from "@/lib/calendar/enqueue";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    // Only the admin may modify leave requests — employees cannot edit once submitted.
    const session = await requirePermission("leave", ["admin"]);
    const { id } = await ctx.params;

    const leave = await cx().query(api.leaves.getLeave, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
    });
    if (!leave) throw new HttpError(404, "Leave request not found");

    const body = await readJson<{
      action?: "approve" | "reject";
      start_date?: string;
      end_date?: string;
      reason?: string;
      leave_type?: string;
      admin_note?: string;
    }>(req);

    try {
      if (body.action === "approve" || body.action === "reject") {
        await cx().mutation(api.leaves.reviewLeave, {
          secret: secret(),
          orgId: session.orgId as never,
          id: id as never,
          action: body.action,
          adminNote: body.admin_note ?? undefined,
          reviewerId: session.id as never,
        });

        const updatedUser = await cx().query(api.auth.getUserById, {
          secret: secret(),
          id: (leave.user_id as string) as never,
          orgId: session.orgId as never,
        });
        if (updatedUser) {
          await notifyLeaveDecision(
            { id: updatedUser._id as unknown as number, name: updatedUser.name, email: updatedUser.email, phone: updatedUser.phone ?? null, leave_balance: updatedUser.leaveBalance },
            body.action === "approve" ? "approved" : "rejected",
            leave.start_date,
            leave.end_date,
            body.admin_note ?? undefined
          );
        }
      } else {
        await cx().mutation(api.leaves.editLeave, {
          secret: secret(),
          orgId: session.orgId as never,
          id: id as never,
          startDate: body.start_date,
          endDate: body.end_date,
          reason: body.reason?.trim() || undefined,
          leaveType:
            body.leave_type && (LEAVE_TYPES as readonly string[]).includes(body.leave_type)
              ? body.leave_type
              : undefined,
          adminNote: body.admin_note ?? undefined,
        });
      }
    } catch (e) {
      return mapConvexError(e);
    }

    // Push the (possibly changed) leave to the requester's connected calendars.
    await queueCalendarSync(session.orgId as string, [leave.user_id as string], "leave", id, "upsert");

    const row = await cx().query(api.leaves.getLeave, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
    });
    return ok({ leave: row });
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("leave", ["admin", "secretary", "manager", "employee"]);
    const { id } = await ctx.params;

    const existing = await cx().query(api.leaves.getLeave, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
    });
    if (!existing) throw new HttpError(404, "Leave request not found");

    // Admins can delete any request; employees may withdraw only their own,
    // and only while it is still pending.
    if (session.role !== "admin") {
      if (existing.user_id !== session.id) throw new HttpError(403, "You can only withdraw your own requests");
      if (existing.status !== "pending") throw new HttpError(403, "Only pending requests can be withdrawn");
    }

    try {
      await cx().mutation(api.leaves.deleteLeave, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
    } catch (e) {
      return mapConvexError(e);
    }

    if (existing) {
      await queueCalendarSync(session.orgId as string, [existing.user_id as string], "leave", id, "delete");
    }
    return ok();
  });
}
