import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** PATCH /api/accounting/credit-notes/[id] — { action: "issue" | "void", allocateToInvoiceId?, allocateToBillId? } */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = await readJson<{
      action: "issue" | "void";
      allocateToInvoiceId?: string;
      allocateToBillId?: string;
    }>(req);
    if (body.action === "void") {
      const session = await requirePermission("accounting-reverse", ["admin"]);
      await cx().mutation(api.subledger.voidCreditNote, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
      await recordAudit(session, { action: "accounting.credit_note_void", module: "accounting", summary: `Voided credit note ${id}` });
      return ok({ ok: true });
    }
    if (body.action === "issue") {
      const session = await requirePermission("accounting-post", ["admin", "secretary"]);
      await cx().mutation(api.subledger.issueCreditNote, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        allocateToInvoiceId: body.allocateToInvoiceId as never,
        allocateToBillId: body.allocateToBillId as never,
      });
      await recordAudit(session, { action: "accounting.credit_note_issue", module: "accounting", summary: `Issued credit note ${id}` });
      return ok({ ok: true });
    }
    throw new HttpError(400, "Unknown action");
  });
}
