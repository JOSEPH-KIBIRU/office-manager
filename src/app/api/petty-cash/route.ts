import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields, maxLen, amountInRange, validDate } from "@/lib/api";
import { notifyAdmins } from "@/lib/notify";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

const AUTO_APPROVE_LIMIT = 5000;

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
    const body = await readJson<{
      items: { amount: number; purpose: string; date_needed: string; costCenterCode?: string; projectId?: string }[];
    }>(req);
    requireFields(body, ["items"]);

    const items = (body.items ?? []).map((it) => ({
      amount: amountInRange(it.amount, "Amount", 1),
      purpose: (maxLen(String(it.purpose ?? ""), "Purpose", 500), String(it.purpose ?? "").trim()),
      date_needed: validDate(String(it.date_needed ?? ""), "Date needed"),
      costCenterCode: it.costCenterCode ? String(it.costCenterCode) : undefined,
      projectId: it.projectId ? String(it.projectId) : undefined,
    }));
    if (items.length === 0) throw new HttpError(400, "At least one line item is required");

    let ids: string[];
    try {
      const res = await cx().mutation(api.pettyCash.createPettyCashBatch, {
        secret: secret(),
        orgId: session.orgId as never,
        requestedBy: session.id as never,
        items: items.map((i) => ({
          amount: i.amount,
          purpose: i.purpose,
          dateNeeded: i.date_needed,
          costCenterCode: i.costCenterCode,
          projectId: i.projectId,
        })) as never,
      });
      ids = res.ids as string[];
    } catch (e) {
      return mapConvexError(e);
    }

    const pending = items.filter((i) => i.amount > AUTO_APPROVE_LIMIT);
    const total = items.reduce((s, i) => s + i.amount, 0);

    if (pending.length > 0) {
      await notifyAdmins(
        session.orgId,
        "New Petty Cash Requests Awaiting Approval",
        `<p><strong>${session.name}</strong> has submitted <strong>${pending.length}</strong> petty cash request(s) above KES ${AUTO_APPROVE_LIMIT.toLocaleString()} requiring approval:</p><ul>${pending
          .map((p) => `<li>KES ${p.amount.toLocaleString()} — ${p.purpose} (needed by ${p.date_needed})</li>`)
          .join("")}</ul><p>Log in to approve or reject.</p>`,
        `Petty cash: ${pending.length} request(s) totaling KES ${pending.reduce((s, i) => s + i.amount, 0).toLocaleString()} from ${session.name} need approval.`
      );
    }

    const autoCount = items.length - pending.length;
    const returned = ids.map((id, i) => ({
      id,
      amount: items[i].amount,
      purpose: items[i].purpose,
      date_needed: items[i].date_needed,
      status: items[i].amount > AUTO_APPROVE_LIMIT ? "pending" : "approved",
    }));

    return ok({
      created: returned,
      auto_approved: autoCount,
      awaiting_approval: pending.length,
      total: total.toLocaleString(),
    });
  });
}
