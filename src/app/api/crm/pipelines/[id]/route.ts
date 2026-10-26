import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-pipeline", ["admin"]);
    const { id } = await ctx.params;
    try {
      const pipeline = await cx().query(api.crmPipelines.getPipeline, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
      return ok({ pipeline });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-pipeline", ["admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{ name?: string; isDefault?: boolean; active?: boolean }>(req);
    try {
      await cx().mutation(api.crmPipelines.updatePipeline, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
        name: body.name,
        isDefault: body.isDefault,
        active: body.active,
      });
      await recordAudit(session, {
        action: "crm.pipeline.update",
        module: "crm",
        summary: `Updated pipeline ${id}`,
        targetType: "crmPipeline",
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
      await cx().mutation(api.crmPipelines.deletePipeline, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
      });
      await recordAudit(session, {
        action: "crm.pipeline.delete",
        module: "crm",
        summary: `Deleted pipeline ${id}`,
        targetType: "crmPipeline",
        targetId: id,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
