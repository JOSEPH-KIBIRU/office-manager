import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { notifyAdmins } from "@/lib/notify";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET() {
  return handle(async () => {
    const session = await requireUser();
    try {
      const requests = await cx().query(api.profiles.listProfileRequests, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: (session.role === "admin" ? null : session.id) as never,
      });
      return ok({ requests });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser();
    const body = await readJson<{ field: "name" | "email"; requested_value: string }>(req);
    requireFields(body, ["field", "requested_value"]);

    if (!["name", "email"].includes(body.field)) throw new HttpError(400, "Invalid field");
    const value = String(body.requested_value).trim();
    if (!value) throw new HttpError(400, "New value cannot be empty");

    if (body.field === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new HttpError(400, "Invalid email address");
    }

    const me = await cx().query(api.auth.getUserById, {
      secret: secret(),
      id: session.id as never,
      orgId: session.orgId as never,
    });
    if (!me) throw new HttpError(401, "Account not found");

    const current = body.field === "name" ? me.name : me.email;
    if (current === value) throw new HttpError(400, `Your ${body.field} is already set to that value`);

    try {
      const pending = await cx().query(api.profiles.hasPendingRequest, {
        secret: secret(),
        userId: session.id as never,
        field: body.field,
      });
      if (pending) throw new HttpError(409, `You already have a pending ${body.field} change request`);

      await cx().mutation(api.profiles.createProfileRequest, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: session.id as never,
        field: body.field,
        currentValue: current,
        requestedValue: body.field === "email" ? value.toLowerCase() : value,
      });
    } catch (e) {
      if (e instanceof HttpError) throw e;
      return mapConvexError(e);
    }

    await notifyAdmins(
      session.orgId,
      "Profile Change Request",
      `<p><strong>${me.name}</strong> requests a change to their <strong>${body.field}</strong>:</p><p>Current: <strong>${current}</strong><br/>Requested: <strong>${value}</strong></p><p>Approve or reject it in the Team section.</p>`,
      `${me.name} requested a ${body.field} change ("${value}"). Review it on the office system.`
    );

    return ok({ note: "Your request has been sent to the admin for review." });
  });
}
