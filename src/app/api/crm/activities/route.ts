import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("crm", ["admin"]);
    const p = new URL(req.url).searchParams;
    const entityType = p.get("entityType") ?? undefined;
    const entityId = p.get("entityId") ?? undefined;
    const limitRaw = p.get("limit");
    try {
      const activities = await cx().query(api.crmActivities.listActivities, {
        secret: secret(),
        orgId: session.orgId as never,
        entityType: entityType as never,
        entityId,
        limit: limitRaw ? Number(limitRaw) : undefined,
      });
      return ok({ activities });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("crm", ["admin"]);
    const body = await readJson<{
      entityType: "company" | "contact" | "lead" | "deal" | "quotation";
      entityId: string;
      type: "note" | "call" | "email" | "meeting" | "stage_change" | "task" | "quotation";
      subject?: string;
      body?: string;
      occurredAt?: number;
      metadata?: unknown;
    }>(req);
    requireFields(body, ["entityType", "entityId", "type"]);
    try {
      const id = await cx().mutation(api.crmActivities.createActivity, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        entityType: body.entityType,
        entityId: String(body.entityId),
        type: body.type,
        subject: body.subject,
        body: body.body,
        occurredAt: body.occurredAt,
        metadata: body.metadata,
      });
      await recordAudit(session, {
        action: "crm.activity.create",
        module: "crm",
        summary: `Logged ${body.type} on ${body.entityType} ${body.entityId}`,
        targetType: body.entityType,
        targetId: String(body.entityId),
      });
      return ok({ id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
