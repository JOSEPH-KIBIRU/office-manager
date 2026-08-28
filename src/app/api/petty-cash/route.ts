import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { notifyAdmins } from "@/lib/notify";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser();
    const scope = req.nextUrl.searchParams.get("scope");
    try {
      const requests = await cx().query(api.pettyCash.listPettyCash, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: (session.role === "admin" && scope !== "mine" ? null : session.id) as never,
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
    const body = await readJson<{ amount: number; purpose: string; date_needed: string }>(req);
    requireFields(body, ["amount", "purpose", "date_needed"]);

    let id: string;
    try {
      id = await cx().mutation(api.pettyCash.createPettyCash, {
        secret: secret(),
        orgId: session.orgId as never,
        requestedBy: session.id as never,
        amount: Number(body.amount),
        purpose: String(body.purpose).trim(),
        dateNeeded: body.date_needed,
      });
    } catch (e) {
      return mapConvexError(e);
    }

    const row = await cx().query(api.pettyCash.getPettyCash, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
    });

    await notifyAdmins(
      session.orgId,
      "New Petty Cash Request",
      `<p><strong>${session.name}</strong> has requested petty cash of <strong>KES ${Number(body.amount).toLocaleString()}</strong>.</p><p><strong>Purpose:</strong> ${body.purpose}<br/><strong>Needed by:</strong> ${body.date_needed}</p><p>Log in to approve or reject.</p>`,
      `Petty cash request ${row?.requisition_no}: KES ${Number(body.amount).toLocaleString()} from ${session.name}. Approve on the office system.`
    );

    return ok({ request: row });
  });
}
