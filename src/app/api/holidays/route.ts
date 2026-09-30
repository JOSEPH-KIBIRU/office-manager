import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** List public holidays for the org. */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("organization", ["admin", "secretary", "manager", "employee"]);
    try {
      const holidays = await cx().query(api.holidays.listHolidays, {
        secret: secret(),
        orgId: session.orgId as never,
      });
      return ok({ holidays });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Add/update a public holiday. Admin or secretary. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("organization", ["admin", "secretary"]);
    const body = await readJson<{ date: string; name: string }>(req);
    requireFields(body, ["date", "name"]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.date))) throw new HttpError(400, "Enter a valid date");
    if (!String(body.name).trim()) throw new HttpError(400, "Enter the holiday name");

    try {
      const res = await cx().mutation(api.holidays.addHoliday, {
        secret: secret(),
        orgId: session.orgId as never,
        date: String(body.date),
        name: String(body.name),
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
