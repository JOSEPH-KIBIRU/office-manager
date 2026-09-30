import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Attendance records (+ today's status, + monthly summary for payroll). */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("attendance", ["admin", "secretary", "manager", "employee"]);
    const url = new URL(req.url);
    const month = url.searchParams.get("month");
    const year = url.searchParams.get("year");

    let from: string | undefined;
    let to: string | undefined;
    let m: number | undefined;
    let y: number | undefined;
    if (month && year) {
      m = Number(month);
      y = Number(year);
      const pad = String(m).padStart(2, "0");
      from = `${y}-${pad}-01`;
      to = `${y}-${pad}-31`;
    }

    try {
      const [records, today] = await Promise.all([
        cx().query(api.attendance.list, {
          secret: secret(),
          orgId: session.orgId as never,
          viewerId: session.id as never,
          from,
          to,
        }),
        cx().query(api.attendance.today, {
          secret: secret(),
          orgId: session.orgId as never,
          userId: session.id as never,
        }),
      ]);
      let summary = null;
      if (m && y) {
        summary = await cx().query(api.attendance.monthlySummary, {
          secret: secret(),
          orgId: session.orgId as never,
          month: m,
          year: y,
        });
      }
      return ok({ records, today, summary });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Clock in or out. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("attendance", ["admin", "secretary", "manager", "employee"]);
    const body = await readJson<{ action?: "in" | "out"; note?: string }>(req);
    if (body.action !== "in" && body.action !== "out") throw new HttpError(400, "action must be 'in' or 'out'");

    try {
      if (body.action === "in") {
        const res = await cx().mutation(api.attendance.clockIn, {
          secret: secret(),
          orgId: session.orgId as never,
          userId: session.id as never,
          note: body.note,
        });
        return ok(res);
      }
      const res = await cx().mutation(api.attendance.clockOut, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: session.id as never,
        note: body.note,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
