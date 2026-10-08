import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields, amountInRange } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** Post a manual journal (a balanced set of ledger lines). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary"]);
    const body = await readJson<{
      date: string;
      description: string;
      adjustment?: boolean;
      lines: Array<{ accountCode: string; debit: number; credit: number; memo?: string; costCenterCode?: string; projectId?: string }>;
    }>(req);
    requireFields(body, ["date", "description"]);
    if (!Array.isArray(body.lines) || body.lines.length < 2) {
      throw new HttpError(400, "A journal needs at least two lines");
    }
    const lines = body.lines.map((l) => ({
      accountCode: String(l.accountCode),
      debit: amountInRange(l.debit ?? 0, "Debit", 0),
      credit: amountInRange(l.credit ?? 0, "Credit", 0),
      memo: l.memo ? String(l.memo) : undefined,
      costCenterCode: l.costCenterCode ? String(l.costCenterCode) : undefined,
      projectId: (l.projectId ? String(l.projectId) : undefined) as never,
    }));
    try {
      const id = await cx().mutation(api.accounting.postManual, {
        secret: secret(),
        orgId: session.orgId as never,
        date: String(body.date),
        description: String(body.description).trim(),
        lines,
        postedBy: session.id as never,
        postedByName: session.name,
        adjustment: !!body.adjustment,
      });
      await recordAudit(session, {
        action: body.adjustment ? "accounting.adjustment" : "accounting.journal",
        module: "accounting",
        summary: `Posted ${body.adjustment ? "adjustment" : "manual"} journal: ${String(body.description).trim()}`,
        targetType: "journal",
        targetId: String(id),
      });
      return ok({ journalId: id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
