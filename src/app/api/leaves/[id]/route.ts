import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { notifyLeaveDecision } from "@/lib/notify";
import { LEAVE_TYPES } from "@/lib/types";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    // Only the admin may modify leave requests — employees cannot edit once submitted.
    const session = await requireUser(["admin"]);
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
            { id: updatedUser._id as unknown as number, name: updatedUser.name, email: updatedUser.email, phone: updatedUser.phone ?? null },
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
    const session = await requireUser(["admin"]);
    const { id } = await ctx.params;
    try {
      await cx().mutation(api.leaves.deleteLeave, {
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
