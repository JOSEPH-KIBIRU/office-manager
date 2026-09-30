import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields, fail, maxLen, validDate } from "@/lib/api";
import { notifyAdminsOfLeaveRequest, notifyLeaveDecision } from "@/lib/notify";
import { LEAVE_TYPES, type LeaveType } from "@/lib/types";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Actual leave days: only working weekdays, excluding public holidays. */
function workingLeaveDays(start: string, end: string, workingDays: number[], holidays: Set<string>): number {
  const wd = new Set(workingDays && workingDays.length ? workingDays : [1, 2, 3, 4, 5]);
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  let count = 0;
  const dt = new Date(s);
  while (dt <= e) {
    const dow = dt.getDay();
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    if (wd.has(dow) && !holidays.has(iso)) count += 1;
    dt.setDate(dt.getDate() + 1);
  }
  return count;
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("leave", ["admin", "secretary", "manager", "employee"]);
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
    const session = await requirePermission("leave", ["admin", "secretary", "manager", "employee"]);
    const body = await readJson<{ start_date: string; end_date: string; reason: string; leave_type?: LeaveType }>(req);
    requireFields(body, ["start_date", "end_date", "reason"]);

    const leaveType = (LEAVE_TYPES as readonly string[]).includes(body.leave_type ?? "")
      ? (body.leave_type as LeaveType)
      : "annual";

    const start = validDate(body.start_date, "Start date");
    const end = validDate(body.end_date, "End date");
    maxLen(body.reason, "Reason", 500);
    if (end < start) return fail(400, "End date cannot be before the start date");

    let wdArr = [1, 2, 3, 4, 5];
    let holDates: string[] = [];
    try {
      const orgCfg = await cx().query(api.organizations.getOrganization, { secret: secret(), orgId: session.orgId as never });
      wdArr = orgCfg.workingDays ?? [1, 2, 3, 4, 5];
      const hols = await cx().query(api.holidays.listHolidays, { secret: secret(), orgId: session.orgId as never });
      holDates = hols.map((h) => h.date);
    } catch {
      /* fall back to Mon–Fri if config can't be read */
    }
    const days = workingLeaveDays(start, end, wdArr, new Set(holDates));
    if (days <= 0) {
      return fail(400, "Those dates fall entirely on weekends or public holidays — there are no leave days to deduct.");
    }
    if (days > 365) return fail(400, "Invalid leave duration");

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
