import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { assertSecret, tsNow, fmtCreated, requireMember } from "./lib";
import { pushNotification } from "./notifications";

type TaskDoc = Doc<"tasks">;
type UpdateDoc = Doc<"taskUpdates">;

const priorityValidator = v.union(
  v.literal("low"),
  v.literal("normal"),
  v.literal("high"),
  v.literal("urgent")
);

async function enrichTask(ctx: QueryCtx, t: TaskDoc) {
  const assignee = await ctx.db.get(t.assigneeId);
  const creator = await ctx.db.get(t.createdBy);
  const acknowledger = t.acknowledgedBy ? await ctx.db.get(t.acknowledgedBy) : null;
  const updates = await ctx.db.query("taskUpdates").withIndex("by_task", (q) => q.eq("taskId", t._id)).collect();
  const reports = updates.filter((u) => u.kind === "report");
  const last = updates.reduce((m, u) => Math.max(m, u.createdAt), t.updatedAt);
  return {
    id: t._id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    due_date: t.dueDate ?? null,
    status: t.status,
    created_by: t.createdBy,
    created_by_name: creator?.name ?? "—",
    assignee_id: t.assigneeId,
    assignee_name: assignee?.name ?? "—",
    acknowledged_by_name: acknowledger?.name ?? null,
    acknowledged_at: t.acknowledgedAt ?? null,
    remark: t.remark ?? null,
    report_count: reports.length,
    comment_count: updates.length - reports.length,
    last_update_at: fmtCreated(last),
    created_at: fmtCreated(t.createdAt),
    updated_at: fmtCreated(t.updatedAt),
  };
}

async function loadTask(ctx: MutationCtx | QueryCtx, orgId: Id<"organizations">, id: Id<"tasks">): Promise<TaskDoc> {
  const t = await ctx.db.get(id);
  if (!t || t.orgId !== orgId) throw new ConvexError("Task not found");
  return t;
}

function canView(t: TaskDoc, viewerId: Id<"users">, isAdmin: boolean): boolean {
  return isAdmin || t.assigneeId === viewerId || t.createdBy === viewerId;
}

export const listTasks = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    viewerId: v.id("users"),
    scope: v.union(v.literal("assigned"), v.literal("created"), v.literal("all")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const viewer = await requireMember(ctx, args.orgId, args.viewerId);
    const isAdmin = viewer.role === "admin";

    const all = await ctx.db.query("tasks").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    let rows: TaskDoc[];
    if (isAdmin && args.scope === "all") rows = all;
    else if (isAdmin && args.scope === "created") rows = all.filter((t) => t.createdBy === args.viewerId);
    else rows = all.filter((t) => t.assigneeId === args.viewerId);

    rows.sort((a, b) => b.updatedAt - a.updatedAt);
    return Promise.all(rows.map((t) => enrichTask(ctx, t)));
  },
});

/** All tasks for a company (for the reports page). Role-gated at the API layer. */
export const reportTasks = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const all = await ctx.db.query("tasks").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    all.sort((a, b) => b.createdAt - a.createdAt);
    return Promise.all(all.map((t) => enrichTask(ctx, t)));
  },
});

export const getTask = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("tasks"),
    viewerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const viewer = await requireMember(ctx, args.orgId, args.viewerId);
    const isAdmin = viewer.role === "admin";
    const t = await ctx.db.get(args.id);
    if (!t || t.orgId !== args.orgId) return null;
    if (!canView(t, args.viewerId, isAdmin)) return null;

    const task = await enrichTask(ctx, t);
    const updates: UpdateDoc[] = await ctx.db
      .query("taskUpdates")
      .withIndex("by_task", (q) => q.eq("taskId", t._id))
      .collect();
    updates.sort((a, b) => a.createdAt - b.createdAt);

    const nameCache = new Map<string, string>();
    const nameOf = async (id: Id<"users">) => {
      if (nameCache.has(id)) return nameCache.get(id)!;
      const u = await ctx.db.get(id);
      const n = u?.name ?? "Unknown";
      nameCache.set(id, n);
      return n;
    };

    const items = await Promise.all(
      updates.map(async (u) => ({
        id: u._id,
        kind: u.kind,
        author_id: u.userId,
        author_name: await nameOf(u.userId),
        description: u.description ?? null,
        doing: u.doing ?? null,
        location: u.location ?? null,
        photos: u.photos.map((p) => ({ url: p.url, name: p.name })),
        created_at: fmtCreated(u.createdAt),
      }))
    );

    return {
      task,
      updates: items,
      can: {
        isAssignee: t.assigneeId === args.viewerId,
        isCreator: t.createdBy === args.viewerId,
        isAdmin,
      },
    };
  },
});

export const createTask = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    createdBy: v.id("users"),
    assigneeId: v.id("users"),
    title: v.string(),
    description: v.string(),
    priority: priorityValidator,
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const creator = await requireMember(ctx, args.orgId, args.createdBy);
    const assignee = await ctx.db.get(args.assigneeId);
    if (!assignee || assignee.orgId !== args.orgId) throw new ConvexError("Assignee is not in your company");
    if (!args.title.trim()) throw new ConvexError("Task title is required");

    const now = tsNow();
    const id = await ctx.db.insert("tasks", {
      orgId: args.orgId,
      title: args.title.trim(),
      description: args.description.trim(),
      priority: args.priority,
      dueDate: args.dueDate?.trim() || undefined,
      status: "open",
      createdBy: args.createdBy,
      assigneeId: args.assigneeId,
      createdAt: now,
      updatedAt: now,
    });

    await pushNotification(ctx, args.orgId as unknown as string, {
      userId: args.assigneeId as unknown as string,
      type: "task",
      title: "New task assigned",
      body: `${creator.name} assigned you: ${args.title.trim()}`,
      link: `/tasks/${id}`,
    });
    return id;
  },
});

export const startTask = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("tasks"), userId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.userId);
    const t = await loadTask(ctx, args.orgId, args.id);
    if (t.assigneeId !== args.userId) throw new ConvexError("Only the assignee can start this task");
    if (!["open", "reopened", "in_progress"].includes(t.status)) throw new ConvexError("This task cannot be started now");
    await ctx.db.patch(t._id, { status: "in_progress", updatedAt: tsNow() });
    return true;
  },
});

export const cancelTask = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("tasks"), userId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const me = await requireMember(ctx, args.orgId, args.userId);
    const t = await loadTask(ctx, args.orgId, args.id);
    if (t.createdBy !== args.userId && me.role !== "admin") throw new ConvexError("Only the task creator can cancel it");
    await ctx.db.patch(t._id, { status: "cancelled", updatedAt: tsNow() });
    return true;
  },
});

export const submitReport = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    taskId: v.id("tasks"),
    userId: v.id("users"),
    description: v.optional(v.string()),
    doing: v.optional(v.string()),
    location: v.optional(v.string()),
    photos: v.array(v.object({ url: v.string(), name: v.string() })),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const me = await requireMember(ctx, args.orgId, args.userId);
    const t = await loadTask(ctx, args.orgId, args.taskId);
    if (t.assigneeId !== args.userId) throw new ConvexError("Only the assignee can submit a report");
    if (t.status === "acknowledged" || t.status === "cancelled") throw new ConvexError("This task is already closed");

    const description = args.description?.trim() || undefined;
    const doing = args.doing?.trim() || undefined;
    const location = args.location?.trim() || undefined;
    if (!description && !doing && !location && args.photos.length === 0) {
      throw new ConvexError("Add some details (or a photo) before submitting");
    }

    await ctx.db.insert("taskUpdates", {
      orgId: args.orgId,
      taskId: t._id,
      userId: args.userId,
      kind: "report",
      description,
      doing,
      location,
      photos: args.photos,
      createdAt: tsNow(),
    });
    await ctx.db.patch(t._id, { status: "submitted", updatedAt: tsNow() });

    await pushNotification(ctx, args.orgId as unknown as string, {
      userId: t.createdBy as unknown as string,
      type: "task",
      title: "Task report submitted",
      body: `${me.name} submitted a report for "${t.title}".`,
      link: `/tasks/${t._id}`,
    });
    return true;
  },
});

export const addComment = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    taskId: v.id("tasks"),
    userId: v.id("users"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const me = await requireMember(ctx, args.orgId, args.userId);
    const t = await loadTask(ctx, args.orgId, args.taskId);
    if (t.assigneeId !== args.userId && t.createdBy !== args.userId && me.role !== "admin") {
      throw new ConvexError("You cannot comment on this task");
    }
    if (!args.text.trim()) throw new ConvexError("Comment is empty");

    await ctx.db.insert("taskUpdates", {
      orgId: args.orgId,
      taskId: t._id,
      userId: args.userId,
      kind: "comment",
      description: args.text.trim(),
      photos: [],
      createdAt: tsNow(),
    });
    await ctx.db.patch(t._id, { updatedAt: tsNow() });

    const other = args.userId === t.assigneeId ? t.createdBy : t.assigneeId;
    await pushNotification(ctx, args.orgId as unknown as string, {
      userId: other as unknown as string,
      type: "task",
      title: "New comment on a task",
      body: `${me.name}: ${args.text.trim().slice(0, 120)}`,
      link: `/tasks/${t._id}`,
    });
    return true;
  },
});

export const acknowledge = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    taskId: v.id("tasks"),
    userId: v.id("users"),
    remark: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const me = await requireMember(ctx, args.orgId, args.userId);
    const t = await loadTask(ctx, args.orgId, args.taskId);
    if (t.createdBy !== args.userId && me.role !== "admin") throw new ConvexError("Only the task creator can acknowledge");
    if (t.status !== "submitted" && t.status !== "reopened") {
      throw new ConvexError("There is no submitted report to acknowledge");
    }
    const remark = args.remark?.trim() || undefined;
    await ctx.db.patch(t._id, {
      status: "acknowledged",
      acknowledgedBy: args.userId,
      acknowledgedAt: fmtCreated(Date.now()),
      remark,
      updatedAt: tsNow(),
    });
    await pushNotification(ctx, args.orgId as unknown as string, {
      userId: t.assigneeId as unknown as string,
      type: "task",
      title: "Task acknowledged",
      body: `"${t.title}" was acknowledged.${remark ? ` Remark: ${remark}` : ""}`,
      link: `/tasks/${t._id}`,
    });
    return true;
  },
});

export const reopen = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    taskId: v.id("tasks"),
    userId: v.id("users"),
    remark: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const me = await requireMember(ctx, args.orgId, args.userId);
    const t = await loadTask(ctx, args.orgId, args.taskId);
    if (t.createdBy !== args.userId && me.role !== "admin") throw new ConvexError("Only the task creator can reopen");
    if (t.status === "cancelled") throw new ConvexError("Cancelled tasks cannot be reopened");
    const remark = args.remark?.trim() || undefined;
    await ctx.db.patch(t._id, {
      status: "reopened",
      acknowledgedBy: undefined,
      acknowledgedAt: undefined,
      remark,
      updatedAt: tsNow(),
    });
    await pushNotification(ctx, args.orgId as unknown as string, {
      userId: t.assigneeId as unknown as string,
      type: "task",
      title: "Task reopened",
      body: `"${t.title}" was reopened.${remark ? ` Remark: ${remark}` : ""}`,
      link: `/tasks/${t._id}`,
    });
    return true;
  },
});
