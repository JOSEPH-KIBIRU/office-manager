import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Reconcile a bank line: book a charge, receive against an invoice, match, or ignore. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary"]);
    const body = await readJson<{
      lineId: string;
      action: "charge" | "receive" | "match" | "ignore";
      invoiceId?: string;
      journalId?: string;
    }>(req);
    requireFields(body, ["lineId", "action"]);

    try {
      if (body.action === "charge") {
        const journalId = await cx().mutation(api.accounting.postBankCharge, {
          secret: secret(),
          orgId: session.orgId as never,
          lineId: body.lineId as never,
          postedBy: session.id as never,
          postedByName: session.name,
        });
        return ok({ journalId });
      }
      if (body.action === "receive") {
        if (!body.invoiceId) throw new HttpError(400, "Invoice is required");
        const journalId = await cx().mutation(api.accounting.receiveAgainstInvoice, {
          secret: secret(),
          orgId: session.orgId as never,
          lineId: body.lineId as never,
          invoiceId: body.invoiceId as never,
          postedBy: session.id as never,
          postedByName: session.name,
        });
        return ok({ journalId });
      }
      if (body.action === "match") {
        if (!body.journalId) throw new HttpError(400, "Journal is required");
        await cx().mutation(api.accounting.matchBankLine, {
          secret: secret(),
          orgId: session.orgId as never,
          lineId: body.lineId as never,
          journalId: body.journalId as never,
        });
        return ok();
      }
      await cx().mutation(api.accounting.ignoreBankLine, {
        secret: secret(),
        orgId: session.orgId as never,
        lineId: body.lineId as never,
      });
      return ok();
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
