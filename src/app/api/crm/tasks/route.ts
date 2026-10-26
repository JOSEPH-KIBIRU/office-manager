import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("crm", ["admin"]);
    const p = new URL(req.url).searchParams;
    try {
      const tasks = await cx().query(api.crmTasks.listTasks, {
        secret: secret(),
        orgId: session.orgId as never,
        assigneeId: (p.get("assigneeId") ?? undefined) as never,
        status: (p.get("status") ?? undefined) as never,
        dealId: (p.get("dealId") ?? undefined) as never,
        companyId: (p.get("companyId") ?? undefined) as never,
        contactId: (p.get("contactId") ?? undefined) as never,
        leadId: (p.get("leadId") ?? undefined) as never,
      });
      return ok({ tasks });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("crm", ["admin"]);
    const body = await readJson<{
      title: string;
      description?: string;
      dueAt?: number;
      priority?: "low" | "normal" | "high" | "urgent";
      assigneeId?: string;
      companyId?: string;
      contactId?: string;
      leadId?: string;
      dealId?: string;
    }>(req);
    requireFields(body, ["title"]);
    try {
      const id = await cx().mutation(api.crmTasks.createTask, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        title: String(body.title),
        description: body.description,
        dueAt: body.dueAt,
        priority: body.priority,
        assigneeId: body.assigneeId as never,
        companyId: body.companyId as never,
        contactId: body.contactId as never,
        leadId: body.leadId as never,
        dealId: body.dealId as never,
      });
      await recordAudit(session, {
        action: "crm.task.create",
        module: "crm",
        summary: `Created follow-up task "${body.title}"`,
        targetType: "crmTask",
        targetId: String(id),
      });
      return ok({ id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
