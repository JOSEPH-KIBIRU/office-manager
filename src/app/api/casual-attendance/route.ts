import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** List casual attendance (optionally for a month) plus per-casual day totals. Admin only. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const url = new URL(req.url);
    const month = url.searchParams.get("month");
    const year = url.searchParams.get("year");
    const m = month ? Number(month) : undefined;
    const y = year ? Number(year) : undefined;

    try {
      const records = await cx().query(api.payroll.listCasualAttendance, {
        secret: secret(),
        orgId: session.orgId as never,
        month: m,
        year: y,
      });
      let summary: Record<string, number> | null = null;
      if (m && y) {
        summary = await cx().query(api.payroll.casualAttendanceSummary, {
          secret: secret(),
          orgId: session.orgId as never,
          month: m,
          year: y,
        });
      }
      return ok({ records, summary });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Log casual attendance for a day. Admin only. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const body = await readJson<{ casualId: string; date: string; days: number; note?: string }>(req);
    requireFields(body, ["casualId", "date"]);
    const days = Number(body.days ?? 1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date))) throw new HttpError(400, "Enter a valid date");
    if (!Number.isFinite(days) || days <= 0) throw new HttpError(400, "Enter a valid number of days");

    try {
      const res = await cx().mutation(api.payroll.logCasualAttendance, {
        secret: secret(),
        orgId: session.orgId as never,
        casualId: body.casualId as never,
        date: String(body.date),
        days,
        note: body.note?.trim() || undefined,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
