import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/**
 * Annual P9 tax deduction card. Admins can pull any employee for any year;
 * everyone else can only pull their own.
 * URL: /api/payroll/p9?year=2026&userId=<optional>
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("my-payslips", ["admin", "secretary", "manager", "employee"]);
    const url = new URL(req.url);
    const year = Number(url.searchParams.get("year"));
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new HttpError(400, "Invalid year");
    }

    const isAdmin = session.role === "admin";
    const requestedUserId = url.searchParams.get("userId");
    const subject = isAdmin && requestedUserId ? requestedUserId : session.id;

    try {
      const data = await cx().query(api.payroll.p9ForYear, {
        secret: secret(),
        orgId: session.orgId as never,
        year,
        viewerId: session.id as never,
        admin: isAdmin,
        userId: subject as never,
      });
      return ok(data);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}