import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields, maxLen } from "@/lib/api";
import { notifyTaskAssigned } from "@/lib/notify";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
type Priority = (typeof PRIORITIES)[number];

/** List tasks (assigned to me / created by me / all for admins). */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("tasks", ["admin", "secretary", "manager", "employee"]);
    const scopeParam = new URL(req.url).searchParams.get("scope") || "assigned";
    const scope = (["assigned", "created", "all"] as const).includes(scopeParam as never)
      ? (scopeParam as "assigned" | "created" | "all")
      : "assigned";
    try {
      const tasks = await cx().query(api.tasks.listTasks, {
        secret: secret(),
        orgId: session.orgId as never,
        viewerId: session.id as never,
        scope,
      });
      return ok({ tasks });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Create a task (admin only). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("tasks", ["admin"]);
    const body = await readJson<{
      title: string;
      description?: string;
      priority?: string;
      dueDate?: string;
      assigneeId: string;
    }>(req);
    requireFields(body, ["title", "assigneeId"]);
    maxLen(body.title, "Title", 200);
    if (body.description !== undefined) maxLen(body.description, "Description", 4000);
    if (body.dueDate !== undefined && body.dueDate !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) {
      throw new HttpError(400, "Due date must be a valid date");
    }
    const priority: Priority = (PRIORITIES as readonly string[]).includes(body.priority ?? "")
      ? (body.priority as Priority)
      : "normal";

    try {
      const id = await cx().mutation(api.tasks.createTask, {
        secret: secret(),
        orgId: session.orgId as never,
        createdBy: session.id as never,
        assigneeId: String(body.assigneeId) as never,
        title: String(body.title).trim(),
        description: body.description?.trim() ?? "",
        priority,
        dueDate: body.dueDate?.trim() || undefined,
      });

      // Text/email the assignee: who issued it, the task, and a link.
      try {
        await notifyTaskAssigned(
          session.orgId as string,
          String(body.assigneeId),
          session.name,
          String(body.title).trim(),
          String(id)
        );
      } catch (e) {
        console.error("[tasks] assignee notify failed:", e);
      }

      return ok({ taskId: id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
