import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** List casual workers for the org. Admin only (payroll). */
export async function GET() {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    try {
      const casuals = await cx().query(api.payroll.listCasuals, {
        secret: secret(),
        orgId: session.orgId as never,
      });
      return ok({ casuals });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Register a casual worker. Admin only. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const body = await readJson<{
      name: string;
      phone?: string;
      idNumber?: string;
      dailyRate: number;
    }>(req);
    requireFields(body, ["name", "dailyRate"]);

    const name = String(body.name).trim();
    const dailyRate = Number(body.dailyRate);
    if (name.length < 2) throw new HttpError(400, "Please enter the casual worker's name");
    if (!Number.isFinite(dailyRate) || dailyRate < 0) throw new HttpError(400, "Enter a valid daily rate");

    try {
      const id = await cx().mutation(api.payroll.createCasual, {
        secret: secret(),
        orgId: session.orgId as never,
        name,
        phone: body.phone?.trim() || undefined,
        idNumber: body.idNumber?.trim() || undefined,
        dailyRate,
      });
      return ok({ id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
