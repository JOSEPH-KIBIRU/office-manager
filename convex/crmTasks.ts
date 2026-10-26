import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, requireOrg, requireMember, tsNow } from "./lib";
import { requireOptionalRef } from "./crmLib";

function clean(s?: string | null): string | undefined {
  const t = (s ?? "").trim();
  return t.length ? t : undefined;
}

const STATUS = v.union(v.literal("open"), v.literal("done"), v.literal("cancelled"));
const PRIORITY = v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent"));

export const listTasks = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    assigneeId: v.optional(v.id("users")),
    status: v.optional(STATUS),
    dealId: v.optional(v.id("crmDeals")),
    companyId: v.optional(v.id("crmCompanies")),
    contactId: v.optional(v.id("crmContacts")),
    leadId: v.optional(v.id("crmLeads")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    const rows = await ctx.db
      .query("crmTasks")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows
      .filter((t) => (args.assigneeId ? t.assigneeId === args.assigneeId : true))
      .filter((t) => (args.status ? t.status === args.status : true))
      .filter((t) => (args.dealId ? t.dealId === args.dealId : true))
      .filter((t) => (args.companyId ? t.companyId === args.companyId : true))
      .filter((t) => (args.contactId ? t.contactId === args.contactId : true))
      .filter((t) => (args.leadId ? t.leadId === args.leadId : true))
      .sort((a, b) => {
        if ((a.status === "open") !== (b.status === "open")) return a.status === "open" ? -1 : 1;
        const ad = a.dueAt ?? Number.MAX_SAFE_INTEGER;
        const bd = b.dueAt ?? Number.MAX_SAFE_INTEGER;
        if (ad !== bd) return ad - bd;
        return b.createdAt - a.createdAt;
      });
  },
});

export const createTask = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    priority: v.optional(PRIORITY),
    assigneeId: v.optional(v.id("users")),
    companyId: v.optional(v.id("crmCompanies")),
    contactId: v.optional(v.id("crmContacts")),
    leadId: v.optional(v.id("crmLeads")),
    dealId: v.optional(v.id("crmDeals")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const title = args.title.trim();
    if (!title) throw new Error("Task title is required");
    if (args.dueAt !== undefined && !Number.isFinite(args.dueAt)) throw new Error("Invalid due date");
    if (args.assigneeId) await requireOptionalRef(ctx, args.orgId, args.assigneeId, "Assignee");
    if (args.companyId) await requireOptionalRef(ctx, args.orgId, args.companyId, "Company");
    if (args.contactId) await requireOptionalRef(ctx, args.orgId, args.contactId, "Contact");
    if (args.leadId) await requireOptionalRef(ctx, args.orgId, args.leadId, "Lead");
    if (args.dealId) await requireOptionalRef(ctx, args.orgId, args.dealId, "Deal");

    const now = tsNow();
    return ctx.db.insert("crmTasks", {
      orgId: args.orgId,
      title,
      description: clean(args.description),
      dueAt: args.dueAt,
      status: "open",
      priority: args.priority ?? "normal",
      assigneeId: args.assigneeId,
      companyId: args.companyId,
      contactId: args.contactId,
      leadId: args.leadId,
      dealId: args.dealId,
      createdBy: args.actorId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateTask = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmTasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    dueAt: v.optional(v.union(v.number(), v.null())),
    priority: v.optional(PRIORITY),
    assigneeId: v.optional(v.union(v.id("users"), v.null())),
    companyId: v.optional(v.union(v.id("crmCompanies"), v.null())),
    contactId: v.optional(v.union(v.id("crmContacts"), v.null())),
    leadId: v.optional(v.union(v.id("crmLeads"), v.null())),
    dealId: v.optional(v.union(v.id("crmDeals"), v.null())),
    status: v.optional(STATUS),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Task not found");

    const patch: Record<string, unknown> = { updatedAt: tsNow() };
    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Task title is required");
      patch.title = title;
    }
    if (args.description !== undefined) patch.description = clean(args.description);
    if (args.priority !== undefined) patch.priority = args.priority;
    if (args.dueAt !== undefined) patch.dueAt = args.dueAt === null ? undefined : args.dueAt;

    for (const [field, label, value] of [
      ["assigneeId", "Assignee", args.assigneeId],
      ["companyId", "Company", args.companyId],
      ["contactId", "Contact", args.contactId],
      ["leadId", "Lead", args.leadId],
      ["dealId", "Deal", args.dealId],
    ] as const) {
      if (value !== undefined) {
        if (value !== null) await requireOptionalRef(ctx, args.orgId, value, label);
        patch[field] = value ?? undefined;
      }
    }

    if (args.status !== undefined) {
      patch.status = args.status;
      patch.completedAt = args.status === "done" ? tsNow() : undefined;
    }

    await ctx.db.patch(args.id, patch);
    return true;
  },
});

export const deleteTask = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmTasks"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Task not found");
    await ctx.db.delete(args.id);
    return true;
  },
});
