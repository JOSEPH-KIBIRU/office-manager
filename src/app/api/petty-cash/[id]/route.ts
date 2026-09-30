import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { notifyUser } from "@/lib/notify";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("petty-cash", ["admin"]);
    const { id } = await ctx.params;

    const row = await cx().query(api.pettyCash.getPettyCash, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
    });
    if (!row) throw new HttpError(404, "Petty cash request not found");

    const body = await readJson<{ action: "approve" | "reject" | "paid"; note?: string }>(req);

    try {
      await cx().mutation(api.pettyCash.reviewPettyCash, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        action: body.action,
        reviewerId: session.id as never,
        note: body.note ?? undefined,
      });
    } catch (e) {
      return mapConvexError(e);
    }

    const amount = Number(row.amount).toLocaleString();
    if (body.action === "approve") {
      await notifyUser(
        session.orgId,
        row.requested_by,
        "Petty Cash Request Approved",
        `<p>Your petty cash request <strong>${row.requisition_no}</strong> for KES ${amount} has been approved.</p><p>You may now collect the funds and generate the requisition form.</p>`,
        `Petty cash ${row.requisition_no} (KES ${amount}) approved. Generate the requisition form on the system.`
      );
    } else if (body.action === "reject") {
      await notifyUser(
        session.orgId,
        row.requested_by,
        "Petty Cash Request Rejected",
        `<p>Your petty cash request <strong>${row.requisition_no}</strong> was rejected.</p>${body.note ? `<p>Note: ${body.note}</p>` : ""}`,
        `Petty cash ${row.requisition_no} rejected.${body.note ? " Note: " + body.note : ""}`
      );
    } else if (body.action === "paid") {
      await notifyUser(
        session.orgId,
        row.requested_by,
        "Petty Cash Disbursed",
        `<p>Petty cash <strong>${row.requisition_no}</strong> (KES ${amount}) has been disbursed to you.</p>`,
        `Petty cash ${row.requisition_no} (KES ${amount}) has been paid out.`
      );
    }

    const updated = await cx().query(api.pettyCash.getPettyCash, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
    });
    return ok({ request: updated });
  });
}
