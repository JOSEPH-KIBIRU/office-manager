import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** GET /api/accounting/recurring */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const rows = await cx().query(api.recurring.listRecurring, { secret: secret(), orgId: session.orgId as never });
    return ok({ recurring: rows });
  });
}

/** POST /api/accounting/recurring */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const body = await readJson<{
      kind: "bill" | "expense" | "journal";
      name: string;
      description?: string;
      frequency: "weekly" | "monthly" | "quarterly" | "yearly";
      startDate: string;
      endDate?: string;
      amount?: number;
      accountCode?: string;
      vatRate?: number;
      taxTreatment?: string;
      supplierId?: string;
      lines?: Array<{ accountCode: string; debit: number; credit: number; memo?: string }>;
    }>(req);
    requireFields(body, ["kind", "name", "frequency", "startDate"]);
    try {
      const res = await cx().mutation(api.recurring.createRecurring, {
        secret: secret(),
        orgId: session.orgId as never,
        kind: body.kind,
        name: String(body.name),
        description: body.description,
        frequency: body.frequency,
        startDate: String(body.startDate),
        endDate: body.endDate,
        amount: Number(body.amount ?? 0),
        accountCode: body.accountCode,
        vatRate: body.vatRate !== undefined ? Number(body.vatRate) : undefined,
        taxTreatment: body.taxTreatment,
        supplierId: body.supplierId as never,
        lines: body.lines,
        createdBy: session.id as never,
      });
      await recordAudit(session, { action: "recurring.create", module: "accounting", summary: `Created recurring ${body.kind} ${body.name}` });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
