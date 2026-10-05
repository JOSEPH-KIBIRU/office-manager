import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";
import { parseDelimited, normalizeStatement } from "@/lib/bankImport";

/**
 * POST /api/banking/transactions/import
 * Body: { accountCode, bankAccountId?, text?, lines? }
 * Accepts raw statement text (CSV/TSV/semicolon, normalized here) OR an
 * already-normalized `lines` array. Duplicates are skipped.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const body = await readJson<{
      accountCode: string;
      bankAccountId?: string;
      text?: string;
      lines?: Array<{ date: string; description: string; amount: number; reference?: string }>;
    }>(req);
    requireFields(body, ["accountCode"]);

    let lines = body.lines;
    if (!lines && body.text) {
      lines = normalizeStatement(parseDelimited(body.text));
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new HttpError(400, "No transactions found to import.");
    }

    try {
      const res = await cx().mutation(api.banking.importTransactions, {
        secret: secret(),
        orgId: session.orgId as never,
        accountCode: body.accountCode,
        bankAccountId: body.bankAccountId as never,
        lines: lines.map((l) => ({
          date: String(l.date),
          description: String(l.description),
          amount: Number(l.amount),
          reference: l.reference,
        })),
      });
      await recordAudit(session, {
        action: "banking.import",
        module: "banking",
        summary: `Imported ${res.imported} transaction(s)${res.skipped ? `, skipped ${res.skipped} duplicate(s)` : ""}`,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
