import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, requireOrg, requireMember, tsNow } from "./lib";
import { requireOptionalRef, requireTenantRef } from "./crmLib";

function clean(s?: string | null): string | undefined {
  const t = (s ?? "").trim();
  return t.length ? t : undefined;
}
function cleanDate(s?: string | null): string | undefined {
  const t = (s ?? "").trim();
  if (!t) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new Error("Expected close date must be YYYY-MM-DD");
  return t;
}

const STATUS = v.union(v.literal("open"), v.literal("won"), v.literal("lost"));

export const listDeals = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    pipelineId: v.optional(v.id("crmPipelines")),
    stageId: v.optional(v.id("crmStages")),
    companyId: v.optional(v.id("crmCompanies")),
    status: v.optional(STATUS),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    const rows = await ctx.db
      .query("crmDeals")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows
      .filter((d) => (args.pipelineId ? d.pipelineId === args.pipelineId : true))
      .filter((d) => (args.stageId ? d.stageId === args.stageId : true))
      .filter((d) => (args.companyId ? d.companyId === args.companyId : true))
      .filter((d) => (args.status ? d.status === args.status : true))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const getDeal = query({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("crmDeals") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) return null;
    return doc;
  },
});

export const createDeal = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    pipelineId: v.id("crmPipelines"),
    stageId: v.id("crmStages"),
    title: v.string(),
    value: v.number(),
    currency: v.optional(v.string()),
    expectedCloseDate: v.optional(v.string()),
    companyId: v.optional(v.id("crmCompanies")),
    contactId: v.optional(v.id("crmContacts")),
    leadId: v.optional(v.id("crmLeads")),
    ownerId: v.optional(v.id("users")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const title = args.title.trim();
    if (!title) throw new Error("Deal title is required");
    if (!Number.isFinite(args.value) || args.value < 0) throw new Error("Enter a valid deal value");

    await requireTenantRef(ctx, args.orgId, args.pipelineId, "Pipeline");
    const stage = await requireTenantRef(ctx, args.orgId, args.stageId, "Stage");
    if (stage.pipelineId !== args.pipelineId) throw new Error("Stage does not belong to that pipeline");

    if (args.companyId) await requireOptionalRef(ctx, args.orgId, args.companyId, "Company");
    if (args.contactId) await requireOptionalRef(ctx, args.orgId, args.contactId, "Contact");
    if (args.leadId) await requireOptionalRef(ctx, args.orgId, args.leadId, "Lead");
    if (args.ownerId) await requireOptionalRef(ctx, args.orgId, args.ownerId, "Owner");

    const now = tsNow();
    return ctx.db.insert("crmDeals", {
      orgId: args.orgId,
      pipelineId: args.pipelineId,
      stageId: args.stageId,
      companyId: args.companyId,
      contactId: args.contactId,
      leadId: args.leadId,
      title,
      value: args.value,
      currency: clean(args.currency) ?? "KES",
      expectedCloseDate: cleanDate(args.expectedCloseDate),
      ownerId: args.ownerId,
      status: "open",
      notes: clean(args.notes),
      createdBy: args.actorId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateDeal = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmDeals"),
    pipelineId: v.optional(v.id("crmPipelines")),
    stageId: v.optional(v.id("crmStages")),
    title: v.optional(v.string()),
    value: v.optional(v.number()),
    currency: v.optional(v.string()),
    expectedCloseDate: v.optional(v.union(v.string(), v.null())),
    companyId: v.optional(v.union(v.id("crmCompanies"), v.null())),
    contactId: v.optional(v.union(v.id("crmContacts"), v.null())),
    leadId: v.optional(v.union(v.id("crmLeads"), v.null())),
    ownerId: v.optional(v.union(v.id("users"), v.null())),
    status: v.optional(STATUS),
    lostReason: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Deal not found");

    const patch: Record<string, unknown> = { updatedAt: tsNow() };

    const pipelineId = args.pipelineId ?? doc.pipelineId;
    const stageId = args.stageId ?? doc.stageId;
    if (args.pipelineId !== undefined || args.stageId !== undefined) {
      await requireTenantRef(ctx, args.orgId, pipelineId, "Pipeline");
      const stage = await requireTenantRef(ctx, args.orgId, stageId, "Stage");
      if (stage.pipelineId !== pipelineId) throw new Error("Stage does not belong to that pipeline");
      patch.pipelineId = pipelineId;
      patch.stageId = stageId;
    }

    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Deal title is required");
      patch.title = title;
    }
    if (args.value !== undefined) {
      if (!Number.isFinite(args.value) || args.value < 0) throw new Error("Enter a valid deal value");
      patch.value = args.value;
    }
    if (args.currency !== undefined) patch.currency = clean(args.currency) ?? "KES";
    if (args.expectedCloseDate !== undefined) {
      patch.expectedCloseDate = args.expectedCloseDate === null ? undefined : cleanDate(args.expectedCloseDate);
    }
    if (args.notes !== undefined) patch.notes = clean(args.notes);
    if (args.lostReason !== undefined) patch.lostReason = clean(args.lostReason);

    if (args.companyId !== undefined) {
      if (args.companyId !== null) await requireOptionalRef(ctx, args.orgId, args.companyId, "Company");
      patch.companyId = args.companyId ?? undefined;
    }
    if (args.contactId !== undefined) {
      if (args.contactId !== null) await requireOptionalRef(ctx, args.orgId, args.contactId, "Contact");
      patch.contactId = args.contactId ?? undefined;
    }
    if (args.leadId !== undefined) {
      if (args.leadId !== null) await requireOptionalRef(ctx, args.orgId, args.leadId, "Lead");
      patch.leadId = args.leadId ?? undefined;
    }
    if (args.ownerId !== undefined) {
      if (args.ownerId !== null) await requireOptionalRef(ctx, args.orgId, args.ownerId, "Owner");
      patch.ownerId = args.ownerId ?? undefined;
    }

    if (args.status !== undefined) {
      patch.status = args.status;
      if (args.status === "won" || args.status === "lost") {
        patch.closedAt = tsNow();
      } else {
        patch.closedAt = undefined;
        patch.lostReason = undefined;
      }
    }

    await ctx.db.patch(args.id, patch);
    return true;
  },
});

export const deleteDeal = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmDeals"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Deal not found");
    await ctx.db.delete(args.id);
    return true;
  },
});
