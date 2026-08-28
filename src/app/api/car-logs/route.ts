import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields, fail } from "@/lib/api";
import { notifyAdmins } from "@/lib/notify";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET() {
  return handle(async () => {
    const session = await requireUser(["admin", "manager"]);
    try {
      const carLogs = await cx().query(api.carLogs.listCarLogs, {
        secret: secret(),
        orgId: session.orgId as never,
      });
      return ok({ carLogs });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser(["admin", "manager"]);
    const body = await readJson<{
      vehicle_reg: string;
      category: string;
      description: string;
      vendor?: string;
      amount: number;
      log_date: string;
    }>(req);
    requireFields(body, ["vehicle_reg", "category", "description", "log_date"]);

    if (!["repair", "insurance", "service"].includes(body.category)) return fail(400, "Invalid category");

    let id: string;
    try {
      id = await cx().mutation(api.carLogs.createCarLog, {
        secret: secret(),
        orgId: session.orgId as never,
        requestedBy: session.id as never,
        vehicleReg: String(body.vehicle_reg).toUpperCase().trim(),
        category: body.category as "repair" | "insurance" | "service",
        description: String(body.description).trim(),
        vendor: body.vendor?.trim() || undefined,
        amount: Number(body.amount) || 0,
        logDate: body.log_date,
      });
    } catch (e) {
      return mapConvexError(e);
    }

    const row = await cx().query(api.carLogs.getCarLog, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
    });

    await notifyAdmins(
      session.orgId,
      `Car ${body.category} logged for approval`,
      `<p>A new <strong>${body.category}</strong> entry has been logged and needs your approval.</p>
       <p><strong>Vehicle:</strong> ${body.vehicle_reg}<br/><strong>Description:</strong> ${body.description}<br/><strong>Amount:</strong> KES ${Number(body.amount).toLocaleString()}</p>`,
      `Car log ${row?.requisition_no}: ${body.category} for ${body.vehicle_reg}, KES ${Number(body.amount).toLocaleString()} awaits your approval.`
    );

    return ok({ carLog: row });
  });
}
