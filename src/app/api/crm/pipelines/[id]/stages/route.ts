import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-pipeline", ["admin"]);
    const { id } = await ctx.params;
    try {
      const stages = await cx().query(api.crmPipelines.listStages, {
        secret: secret(),
        orgId: session.orgId as never,
        pipelineId: id as never,
      });
      return ok({ stages });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm-pipeline", ["admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      name: string;
      order?: number;
      probability?: number;
      isWon?: boolean;
      isLost?: boolean;
    }>(req);
    requireFields(body, ["name"]);
    try {
      const stageId = await cx().mutation(api.crmPipelines.createStage, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        pipelineId: id as never,
        name: String(body.name),
        order: body.order,
        probability: body.probability,
        isWon: body.isWon,
        isLost: body.isLost,
      });
      await recordAudit(session, {
        action: "crm.stage.create",
        module: "crm",
        summary: `Added stage "${body.name}"`,
        targetType: "crmStage",
        targetId: String(stageId),
      });
      return ok({ id: stageId });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
