import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** List imported bank/M-Pesa lines. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const accountCode = new URL(req.url).searchParams.get("accountCode") || undefined;
    try {
      const lines = await cx().query(api.accounting.listBankLines, {
        secret: secret(),
        orgId: session.orgId as never,
        accountCode,
      });
      return ok({ lines });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Import bank/M-Pesa statement lines. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary"]);
    const body = await readJson<{
      accountCode: string;
      lines: Array<{ date: string; description: string; amount: number; reference?: string }>;
    }>(req);
    requireFields(body, ["accountCode"]);
    if (!Array.isArray(body.lines) || body.lines.length === 0) throw new HttpError(400, "No lines to import");
    if (body.lines.length > 2000) throw new HttpError(400, "Too many lines (max 2000 per import)");
    try {
      const result = await cx().mutation(api.accounting.importBankLines, {
        secret: secret(),
        orgId: session.orgId as never,
        accountCode: String(body.accountCode),
        lines: body.lines.map((l) => ({
          date: String(l.date),
          description: String(l.description),
          amount: Number(l.amount),
          reference: l.reference ? String(l.reference) : undefined,
        })),
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
