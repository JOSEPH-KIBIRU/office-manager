import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("crm", ["admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      title?: string;
      description?: string;
      dueAt?: number | null;
      priority?: "low" | "normal" | "high" | "urgent";
      assigneeId?: string | null;
      companyId?: string | null;
      contactId?: string | null;
      leadId?: string | null;
      dealId?: string | null;
      status?: "open" | "done" | "cancelled";
    }>(req);
    try {
      await cx().mutation(api.crmTasks.updateTask, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
        title: body.title,
        description: body.description,
        dueAt: body.dueAt as never,
        priority: body.priority,
        assigneeId: body.assigneeId as never,
        companyId: body.companyId as never,
        contactId: body.contactId as never,
        leadId: body.leadId as never,
        dealId: body.dealId as never,
        status: body.status,
      });
      await recordAudit(session, {
        action: "crm.task.update",
        module: "crm",
        summary: `Updated task ${id}`,
        targetType: "crmTask",
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
    const session = await requirePermission("crm", ["admin"]);
    const { id } = await ctx.params;
    try {
      await cx().mutation(api.crmTasks.deleteTask, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        id: id as never,
      });
      await recordAudit(session, {
        action: "crm.task.delete",
        module: "crm",
        summary: `Deleted task ${id}`,
        targetType: "crmTask",
        targetId: id,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
