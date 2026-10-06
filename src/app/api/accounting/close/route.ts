import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/**
 * GET  /api/accounting/close?period=YYYY-MM  → checklist + integrity summary
 * POST /api/accounting/close — { action: "task" | "close" | "status", ... }
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const period = new URL(req.url).searchParams.get("period");
    if (!period) throw new HttpError(400, "period is required");
    await cx().mutation(api.close.ensureChecklistMutation, { secret: secret(), orgId: session.orgId as never, period });
    const data = await cx().query(api.close.getChecklist, { secret: secret(), orgId: session.orgId as never, period });
    return ok(data);
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const body = await readJson<{
      action: "task" | "close" | "status";
      period: string;
      key?: string;
      status?: string;
      note?: string;
      force?: boolean;
    }>(req);
    if (!body.period) throw new HttpError(400, "period is required");
    try {
      if (body.action === "task") {
        if (!body.key || !body.status) throw new HttpError(400, "key and status are required");
        await cx().mutation(api.close.setTaskStatus, {
          secret: secret(),
          orgId: session.orgId as never,
          period: body.period,
          key: body.key,
          status: body.status as never,
          note: body.note,
          updatedBy: session.id as never,
          updatedByName: session.name,
        });
        return ok({ ok: true });
      }
      if (body.action === "status") {
        if (!body.status) throw new HttpError(400, "status is required");
        const res = await cx().mutation(api.close.setPeriodStatus, {
          secret: secret(),
          orgId: session.orgId as never,
          period: body.period,
          status: body.status as never,
          byName: session.name,
        });
        await recordAudit(session, { action: "period.status", module: "accounting", summary: `Set ${body.period} to ${body.status}` });
        return ok(res);
      }
      // close
      const res = await cx().mutation(api.close.closePeriod, {
        secret: secret(),
        orgId: session.orgId as never,
        period: body.period,
        force: body.force,
        closedBy: session.id as never,
        closedByName: session.name,
      });
      await recordAudit(session, { action: "period.close", module: "accounting", summary: `Closed period ${body.period}` });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
