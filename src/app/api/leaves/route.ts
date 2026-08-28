import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok, readJson, requireFields, fail } from "@/lib/api";
import { notifyAdminsOfLeaveRequest, notifyLeaveDecision } from "@/lib/notify";
import { LEAVE_TYPES, type LeaveType } from "@/lib/types";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

function daysBetween(start: string, end: string): number {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser();
    const mineOnly = session.role !== "admin" || req.nextUrl.searchParams.get("scope") === "mine";

    try {
      const leaves = await cx().query(api.leaves.listLeaves, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: (mineOnly ? session.id : null) as never,
      });
      const balance = await cx().query(api.leaves.getLeaveBalance, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: session.id as never,
      });
      return ok({ leaves, leave_balance: balance });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser();
    const body = await readJson<{ start_date: string; end_date: string; reason: string; leave_type?: LeaveType }>(req);
    requireFields(body, ["start_date", "end_date", "reason"]);

    const leaveType = (LEAVE_TYPES as readonly string[]).includes(body.leave_type ?? "")
      ? (body.leave_type as LeaveType)
      : "annual";

    const start = String(body.start_date);
    const end = String(body.end_date);
    if (end < start) return fail(400, "End date cannot be before the start date");

    const days = daysBetween(start, end);
    if (days <= 0 || days > 365) return fail(400, "Invalid leave duration");

    let newId;
    try {
      newId = await cx().mutation(api.leaves.applyLeave, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: session.id as never,
        startDate: start,
        endDate: end,
        days,
        leaveType,
        reason: String(body.reason).trim(),
      });
    } catch (e) {
      return mapConvexError(e);
    }

    const me = await cx().query(api.auth.getUserById, {
      secret: secret(),
      id: session.id as never,
      orgId: session.orgId as never,
    });
    if (me) {
      await notifyAdminsOfLeaveRequest(
        session.orgId,
        { id: me._id, name: me.name, email: me.email, phone: me.phone ?? null },
        days,
        start,
        end,
        leaveType
      );
    }

    const row = await cx().query(api.leaves.getLeave, {
      secret: secret(),
      orgId: session.orgId as never,
      id: newId as never,
    });
    return ok({ leave: row });
  });
}
