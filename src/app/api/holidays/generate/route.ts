import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Auto-generate Kenya's public holidays (fixed + Easter + Eid) for a year. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser(["admin", "secretary"]);
    const body = await readJson<{ year?: number }>(req);
    const year = Number(body.year ?? new Date().getFullYear());
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new HttpError(400, "Invalid year");

    try {
      const res = await cx().mutation(api.holidays.generateHolidays, {
        secret: secret(),
        orgId: session.orgId as never,
        year,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
