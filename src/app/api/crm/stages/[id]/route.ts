import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-pipeline", ["admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      name?: string;
      order?: number;
      probability?: number;
      isWon?: boolean;
      isLost?: boolean;
    }>(req);
    try {
      await cx().mutation(api.crmPipelines.updateStage, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
        name: body.name,
        order: body.order,
        probability: body.probability,
        isWon: body.isWon,
        isLost: body.isLost,
      });
      await recordAudit(session, {
        action: "crm.stage.update",
        module: "crm",
        summary: `Updated stage ${id}`,
        targetType: "crmStage",
        targetId: id,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-pipeline", ["admin"]);
    const { id } = await ctx.params;
    try {
      await cx().mutation(api.crmPipelines.deleteStage, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
      });
      await recordAudit(session, {
        action: "crm.stage.delete",
        module: "crm",
        summary: `Deleted stage ${id}`,
        targetType: "crmStage",
        targetId: id,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
