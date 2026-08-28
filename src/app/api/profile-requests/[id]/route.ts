import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { notifyUser } from "@/lib/notify";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const { id } = await ctx.params;

    const row = await cx().query(api.profiles.getProfileRequest, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
    });
    if (!row) throw new HttpError(404, "Request not found");
    if (row.status !== "pending") throw new HttpError(400, `This request was already ${row.status}`);

    const body = await readJson<{ action: "approve" | "reject" }>(req);

    try {
      await cx().mutation(api.profiles.reviewProfileRequest, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        action: body.action,
        reviewerId: session.id as never,
      });
    } catch (e) {
      return mapConvexError(e);
    }

    await notifyUser(
      session.orgId,
      row.user_id,
      `Profile Change Request ${body.action === "approve" ? "Approved" : "Rejected"}`,
      `<p>Your request to change your <strong>${row.field}</strong> to <strong>${row.requested_value}</strong> has been <strong>${body.action.toUpperCase()}</strong>.</p>`,
      `Your ${row.field} change request was ${body.action}.`
    );

    const updated = await cx().query(api.profiles.getProfileRequest, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
    });
    return ok({ request: updated });
  });
}
