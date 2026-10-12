import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/**
 * Manager/admin correction of an attendance record — fixes a missed clock-out,
 * adds a missed day, or edits times. Clock-in/out are "HH:MM" (EAT).
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("attendance-manage", ["admin", "secretary", "manager"]);
    const body = await readJson<{
      user_id?: string;
      date?: string;
      clock_in?: string;
      clock_out?: string | null;
      note?: string;
    }>(req);

    if (!body.user_id) throw new HttpError(400, "user_id is required");
    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      throw new HttpError(400, "A valid date (YYYY-MM-DD) is required");
    }

    const hhmm = (s: string) => {
      if (!/^\d{1,2}:\d{2}$/.test(s)) throw new HttpError(400, "Times must be HH:MM");
      const [h, m] = s.split(":").map(Number);
      if (h > 23 || m > 59) throw new HttpError(400, "Times must be HH:MM");
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    const clockIn = body.clock_in ? hhmm(body.clock_in) : undefined;
    let clockOut: string | undefined;
    if (body.clock_out === undefined) clockOut = undefined;
    else if (body.clock_out === null || body.clock_out === "") clockOut = "";
    else clockOut = hhmm(body.clock_out);
    if (!clockIn && clockOut === undefined) throw new HttpError(400, "A clock-in time is required");

    try {
      const result = await cx().mutation(api.attendance.correctAttendance, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: body.user_id as never,
        date: body.date,
        clockIn: clockIn as never,
        clockOut: clockOut as never,
        note: body.note,
      });
      await recordAudit(session, {
        action: "attendance.correct",
        module: "attendance",
        summary: `Corrected attendance for ${body.date}`,
        targetType: "attendance",
        targetId: body.user_id,
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
