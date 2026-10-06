import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** GET / POST / DELETE /api/management/budgets */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("budgets", ["admin", "secretary", "manager"]);
    const budgets = await cx().query(api.management.listBudgets, { secret: secret(), orgId: session.orgId as never });
    return ok({ budgets });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("budgets", ["admin", "secretary"]);
    const body = await readJson<{
      period: string;
      frequency: "annual" | "monthly";
      accountCode: string;
      costCenterCode?: string;
      projectId?: string;
      amount: number;
      note?: string;
    }>(req);
    requireFields(body, ["period", "frequency", "accountCode", "amount"]);
    try {
      const res = await cx().mutation(api.management.upsertBudget, {
        secret: secret(),
        orgId: session.orgId as never,
        period: String(body.period),
        frequency: body.frequency,
        accountCode: String(body.accountCode),
        costCenterCode: body.costCenterCode || undefined,
        projectId: body.projectId as never,
        amount: Number(body.amount),
        note: body.note,
        createdBy: session.id as never,
      });
      await recordAudit(session, { action: "management.budget_set", module: "management", summary: `Budget ${body.period} ${body.accountCode} = ${body.amount}` });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("budgets", ["admin", "secretary"]);
    const body = await readJson<{ id: string }>(req);
    if (!body.id) throw new Error("id is required");
    try {
      await cx().mutation(api.management.deleteBudget, { secret: secret(), orgId: session.orgId as never, id: body.id as never });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
