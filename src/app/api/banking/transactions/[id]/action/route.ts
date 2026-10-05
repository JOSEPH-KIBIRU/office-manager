import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/**
 * POST /api/banking/transactions/[id]/action
 * Body: { action: "match"|"receipt"|"payment"|"expense"|"ignore"|"unmatch", ... }
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      action: "match" | "receipt" | "payment" | "expense" | "ignore" | "unmatch";
      journalId?: string;
      contactId?: string;
      counterAccountCode?: string;
      amount?: number;
    }>(req);

    const base = { secret: secret(), orgId: session.orgId as never, lineId: id as never };
    try {
      let res: unknown;
      switch (body.action) {
        case "match":
          if (!body.journalId) throw new HttpError(400, "journalId is required");
          res = await cx().mutation(api.banking.matchLineToJournal, { ...base, journalId: body.journalId as never, amount: body.amount, createdByName: session.name });
          break;
        case "receipt":
          res = await cx().mutation(api.banking.receiptFromLine, { ...base, contactId: body.contactId as never, amount: body.amount, createdByName: session.name });
          break;
        case "payment":
          res = await cx().mutation(api.banking.paymentFromLine, { ...base, contactId: body.contactId as never, amount: body.amount, createdByName: session.name });
          break;
        case "expense":
          if (!body.counterAccountCode) throw new HttpError(400, "counterAccountCode is required");
          res = await cx().mutation(api.banking.expenseFromLine, { ...base, counterAccountCode: body.counterAccountCode, amount: body.amount, createdByName: session.name });
          break;
        case "ignore":
          res = await cx().mutation(api.banking.ignoreLine, base);
          break;
        case "unmatch":
          res = await cx().mutation(api.banking.unmatchLine, base);
          break;
        default:
          throw new HttpError(400, "Unknown action");
      }
      await recordAudit(session, {
        action: `banking.${body.action}`,
        module: "banking",
        summary: `Reconciliation action: ${body.action}`,
        targetType: "bankLine",
        targetId: id,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
