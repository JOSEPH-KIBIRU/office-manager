import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export async function GET() {
  return handle(async () => {
    const session = await requirePermission("crm-pipeline", ["admin"]);
    try {
      const pipelines = await cx().query(api.crmPipelines.listPipelines, {
        secret: secret(),
        orgId: session.orgId as never,
      });
      return ok({ pipelines });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("crm-pipeline", ["admin"]);
    const body = await readJson<{ name: string; isDefault?: boolean }>(req);
    requireFields(body, ["name"]);
    try {
      const id = await cx().mutation(api.crmPipelines.createPipeline, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        name: String(body.name),
        isDefault: body.isDefault,
      });
      await recordAudit(session, {
        action: "crm.pipeline.create",
        module: "crm",
        summary: `Created pipeline "${body.name}"`,
        targetType: "crmPipeline",
        targetId: String(id),
      });
      return ok({ id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
