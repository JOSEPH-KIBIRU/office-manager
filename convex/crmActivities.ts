import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, requireOrg, requireMember, tsNow } from "./lib";
import { requireActivityEntity } from "./crmLib";

const ENTITY_TYPE = v.union(
  v.literal("company"),
  v.literal("contact"),
  v.literal("lead"),
  v.literal("deal"),
  v.literal("quotation")
);
const ACTIVITY_TYPE = v.union(
  v.literal("note"),
  v.literal("call"),
  v.literal("email"),
  v.literal("meeting"),
  v.literal("stage_change"),
  v.literal("task"),
  v.literal("quotation")
);

export const listActivities = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    entityType: v.optional(ENTITY_TYPE),
    entityId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    if (args.entityType && !args.entityId) throw new Error("entityId is required when filtering by entity");
    if (!args.entityType && args.entityId) throw new Error("entityType is required when filtering by entity");

    let rows;
    if (args.entityType && args.entityId) {
      await requireActivityEntity(ctx, args.orgId, args.entityType, args.entityId);
      rows = await ctx.db
        .query("crmActivities")
        .withIndex("by_org_entity", (q) =>
          q.eq("orgId", args.orgId).eq("entityType", args.entityType!).eq("entityId", args.entityId!)
        )
        .collect();
    } else {
      rows = await ctx.db
        .query("crmActivities")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
    }
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    return [...rows].sort((a, b) => b.occurredAt - a.occurredAt).slice(0, limit);
  },
});

export const createActivity = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    entityType: ENTITY_TYPE,
    entityId: v.string(),
    type: ACTIVITY_TYPE,
    subject: v.optional(v.string()),
    body: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    await requireActivityEntity(ctx, args.orgId, args.entityType, args.entityId);
    const now = tsNow();
    const id = await ctx.db.insert("crmActivities", {
      orgId: args.orgId,
      entityType: args.entityType,
      entityId: args.entityId,
      type: args.type,
      subject: args.subject?.trim() || undefined,
      body: args.body?.trim() || undefined,
      occurredAt: args.occurredAt ?? now,
      actorId: args.actorId,
      metadata: args.metadata,
      createdAt: now,
    });
    try {
      const entity = await ctx.db.get(args.entityId as never);
      if (entity && (entity as { orgId?: unknown }).orgId === args.orgId) {
        await ctx.db.patch((entity as { _id: any })._id, { updatedAt: now });
      }
    } catch {
      /* activity is still recorded if the source record was removed */
    }
    return id;
  },
});

export const deleteActivity = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmActivities"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Activity not found");
    await ctx.db.delete(args.id);
    return true;
  },
});
