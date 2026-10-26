import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, requireOrg, requireMember, tsNow } from "./lib";
import { requireTenantRef } from "./crmLib";

export const listPipelines = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    const rows = await ctx.db
      .query("crmPipelines")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return [...rows].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  },
});

export const getPipeline = query({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("crmPipelines") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) return null;
    return doc;
  },
});

export const createPipeline = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    name: v.string(),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const name = args.name.trim();
    if (!name) throw new Error("Pipeline name is required");
    const existing = await ctx.db
      .query("crmPipelines")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const makeDefault = args.isDefault ?? existing.length === 0;
    if (makeDefault) {
      for (const p of existing) if (p.isDefault) await ctx.db.patch(p._id, { isDefault: false });
    }
    const now = tsNow();
    return ctx.db.insert("crmPipelines", {
      orgId: args.orgId,
      name,
      isDefault: makeDefault,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updatePipeline = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmPipelines"),
    name: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Pipeline not found");

    const patch: Record<string, unknown> = { updatedAt: tsNow() };
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Pipeline name is required");
      patch.name = name;
    }
    if (args.active !== undefined) patch.active = args.active;
    if (args.isDefault !== undefined) {
      if (args.isDefault) {
        const others = await ctx.db
          .query("crmPipelines")
          .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
          .collect();
        for (const p of others) {
          if (p._id !== args.id && p.isDefault) await ctx.db.patch(p._id, { isDefault: false });
        }
      }
      patch.isDefault = args.isDefault;
    }
    await ctx.db.patch(args.id, patch);
    return true;
  },
});

export const deletePipeline = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmPipelines"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Pipeline not found");

    const stages = await ctx.db
      .query("crmStages")
      .withIndex("by_org_pipeline", (q) => q.eq("orgId", args.orgId).eq("pipelineId", args.id))
      .collect();
    for (const stage of stages) {
      const deal = await ctx.db
        .query("crmDeals")
        .withIndex("by_org_stage", (q) => q.eq("orgId", args.orgId).eq("stageId", stage._id))
        .first();
      if (deal) throw new Error("Move or delete this pipeline's deals first");
    }
    for (const stage of stages) await ctx.db.delete(stage._id);
    await ctx.db.delete(args.id);
    return true;
  },
});

export const listStages = query({
  args: { secret: v.string(), orgId: v.id("organizations"), pipelineId: v.id("crmPipelines") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    await requireTenantRef(ctx, args.orgId, args.pipelineId, "Pipeline");
    const rows = await ctx.db
      .query("crmStages")
      .withIndex("by_org_pipeline", (q) => q.eq("orgId", args.orgId).eq("pipelineId", args.pipelineId))
      .collect();
    return [...rows].sort((a, b) => a.order - b.order);
  },
});

export const createStage = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    pipelineId: v.id("crmPipelines"),
    name: v.string(),
    order: v.optional(v.number()),
    probability: v.optional(v.number()),
    isWon: v.optional(v.boolean()),
    isLost: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    await requireTenantRef(ctx, args.orgId, args.pipelineId, "Pipeline");
    const name = args.name.trim();
    if (!name) throw new Error("Stage name is required");
    if (args.probability !== undefined && (args.probability < 0 || args.probability > 100)) {
      throw new Error("Probability must be between 0 and 100");
    }
    const existing = await ctx.db
      .query("crmStages")
      .withIndex("by_org_pipeline", (q) => q.eq("orgId", args.orgId).eq("pipelineId", args.pipelineId))
      .collect();
    const order = args.order ?? (existing.length ? Math.max(...existing.map((s) => s.order)) + 1 : 0);
    return ctx.db.insert("crmStages", {
      orgId: args.orgId,
      pipelineId: args.pipelineId,
      name,
      order,
      probability: args.probability,
      isWon: args.isWon ?? false,
      isLost: args.isLost ?? false,
      createdAt: tsNow(),
    });
  },
});

export const updateStage = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmStages"),
    name: v.optional(v.string()),
    order: v.optional(v.number()),
    probability: v.optional(v.number()),
    isWon: v.optional(v.boolean()),
    isLost: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Stage not found");
    if (args.probability !== undefined && (args.probability < 0 || args.probability > 100)) {
      throw new Error("Probability must be between 0 and 100");
    }
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Stage name is required");
      patch.name = name;
    }
    if (args.order !== undefined) patch.order = args.order;
    if (args.probability !== undefined) patch.probability = args.probability;
    if (args.isWon !== undefined) patch.isWon = args.isWon;
    if (args.isLost !== undefined) patch.isLost = args.isLost;
    await ctx.db.patch(args.id, patch);
    return true;
  },
});

export const deleteStage = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmStages"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Stage not found");
    const deal = await ctx.db
      .query("crmDeals")
      .withIndex("by_org_stage", (q) => q.eq("orgId", args.orgId).eq("stageId", args.id))
      .first();
    if (deal) throw new Error("Move or delete this stage's deals first");
    await ctx.db.delete(args.id);
    return true;
  },
});
