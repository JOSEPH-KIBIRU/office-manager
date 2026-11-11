import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, requireOrg, requireMember, tsNow } from "./lib";
import { requireOptionalRef } from "./crmLib";

function clean(s?: string | null): string | undefined {
  const t = (s ?? "").trim();
  return t.length ? t : undefined;
}

const STATUS = v.union(
  v.literal("new"),
  v.literal("contacted"),
  v.literal("qualified"),
  v.literal("disqualified"),
  v.literal("converted")
);

export const listLeads = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    status: v.optional(STATUS),
    q: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    const rows = await ctx.db
      .query("crmLeads")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const needle = args.q?.trim().toLowerCase();
    return rows
      .filter((r) => (args.status ? r.status === args.status : true))
      .filter((r) =>
        needle
          ? (r.companyName ?? "").toLowerCase().includes(needle) ||
            (r.contactName ?? "").toLowerCase().includes(needle) ||
            (r.email ?? "").toLowerCase().includes(needle)
          : true
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getLead = query({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("crmLeads") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) return null;
    return doc;
  },
});

export const createLead = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    companyName: v.optional(v.string()),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    source: v.optional(v.string()),
    ownerId: v.optional(v.id("users")),
    value: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const companyName = clean(args.companyName);
    const contactName = clean(args.contactName);
    const email = clean(args.email);
    if (!companyName && !contactName && !email) {
      throw new Error("Enter at least a company name, contact name or email");
    }
    if (args.ownerId) await requireOptionalRef(ctx, args.orgId, args.ownerId, "Owner");
    if (args.value !== undefined && (!Number.isFinite(args.value) || args.value < 0)) {
      throw new Error("Enter a valid estimated value");
    }
    const now = tsNow();
    return ctx.db.insert("crmLeads", {
      orgId: args.orgId,
      companyName,
      contactName,
      email,
      phone: clean(args.phone),
      source: clean(args.source),
      status: "new",
      ownerId: args.ownerId,
      value: args.value,
      notes: clean(args.notes),
      createdBy: args.actorId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateLead = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmLeads"),
    companyName: v.optional(v.string()),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    source: v.optional(v.string()),
    ownerId: v.optional(v.union(v.id("users"), v.null())),
    value: v.optional(v.union(v.number(), v.null())),
    notes: v.optional(v.string()),
    status: v.optional(STATUS),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Lead not found");
    if (args.status === "converted") {
      throw new Error("Use the convert action to turn a lead into a deal");
    }
    if (args.value !== undefined && args.value !== null) {
      if (!Number.isFinite(args.value) || args.value < 0) throw new Error("Enter a valid estimated value");
    }

    const patch: Record<string, unknown> = { updatedAt: tsNow() };
    if (args.companyName !== undefined) patch.companyName = clean(args.companyName);
    if (args.contactName !== undefined) patch.contactName = clean(args.contactName);
    if (args.email !== undefined) patch.email = clean(args.email);
    if (args.phone !== undefined) patch.phone = clean(args.phone);
    if (args.source !== undefined) patch.source = clean(args.source);
    if (args.notes !== undefined) patch.notes = clean(args.notes);
    if (args.status !== undefined) patch.status = args.status;
    if (args.ownerId !== undefined) {
      if (args.ownerId !== null) await requireOptionalRef(ctx, args.orgId, args.ownerId, "Owner");
      patch.ownerId = args.ownerId ?? undefined;
    }
    if (args.value !== undefined) patch.value = args.value ?? undefined;

    await ctx.db.patch(args.id, patch);
    return true;
  },
});

export const convertLead = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmLeads"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const lead = await ctx.db.get(args.id);
    if (!lead || lead.orgId !== args.orgId) throw new Error("Lead not found");
    if (lead.status === "converted") throw new Error("This lead has already been converted");

    const now = tsNow();

    // 1. Company (only when the lead carries a company name).
    let companyId: any = undefined;
    const companyName = clean(lead.companyName);
    if (companyName) {
      companyId = await ctx.db.insert("crmCompanies", {
        orgId: args.orgId,
        name: companyName,
        phone: lead.phone,
        source: lead.source,
        ownerId: lead.ownerId,
        active: true,
        createdBy: args.actorId,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 2. Contact (when there is a person or email to record).
    let contactId: any = undefined;
    const contactName = clean(lead.contactName) ?? clean(lead.email);
    if (contactName) {
      contactId = await ctx.db.insert("crmContacts", {
        orgId: args.orgId,
        companyId,
        name: contactName,
        email: lead.email,
        phone: lead.phone,
        ownerId: lead.ownerId,
        createdBy: args.actorId,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 3. Default pipeline + first open stage.
    const pipelines = await ctx.db
      .query("crmPipelines")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const pipeline =
      pipelines.find((p) => p.isDefault && p.active) ??
      pipelines.find((p) => p.active) ??
      pipelines[0];
    if (!pipeline) throw new Error("Create a pipeline with a stage before converting leads");

    const stageRows = await ctx.db
      .query("crmStages")
      .withIndex("by_org_pipeline", (q) => q.eq("orgId", args.orgId).eq("pipelineId", pipeline._id))
      .collect();
    const ordered = [...stageRows].sort((a, b) => a.order - b.order);
    const stage = ordered.find((s) => !s.isWon && !s.isLost) ?? ordered[0];
    if (!stage) throw new Error("Add a stage to your pipeline before converting leads");

    // 4. Deal.
    const dealId = await ctx.db.insert("crmDeals", {
      orgId: args.orgId,
      pipelineId: pipeline._id,
      stageId: stage._id,
      companyId,
      contactId,
      leadId: lead._id,
      title: companyName ?? contactName ?? "New deal",
      value: lead.value ?? 0,
      currency: "KES",
      ownerId: lead.ownerId,
      status: "open",
      notes: lead.notes,
      createdBy: args.actorId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(lead._id, {
      status: "converted",
      convertedCompanyId: companyId,
      convertedContactId: contactId,
      convertedDealId: dealId,
      updatedAt: now,
    });

    return { dealId, companyId, contactId };
  },
});

export const deleteLead = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmLeads"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Lead not found");
    await ctx.db.delete(args.id);
    return true;
  },
});
/** Store AI qualification metadata on a lead (or refresh it). */
export const updateLeadAI = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("crmLeads"),
    score: v.number(),
    confidence: v.optional(v.number()),
    summary: v.optional(v.string()),
    intent: v.optional(v.string()),
    nextAction: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const lead = await ctx.db.get(args.id);
    if (!lead || lead.orgId !== args.orgId) throw new Error("Lead not found");
    if (!Number.isFinite(args.score) || args.score < 0 || args.score > 100) {
      throw new Error("AI score must be between 0 and 100");
    }
    const confidence =
      args.confidence === undefined
        ? undefined
        : Math.max(0, Math.min(1, Number(args.confidence)));
    await ctx.db.patch(args.id, {
      aiScore: Math.round(args.score),
      aiConfidence: confidence,
      aiSummary: clean(args.summary)?.slice(0, 1200),
      aiIntent: clean(args.intent)?.slice(0, 300),
      aiNextAction: clean(args.nextAction)?.slice(0, 500),
      aiModel: clean(args.model)?.slice(0, 120),
      aiUpdatedAt: tsNow(),
    });
    return true;
  },
});

/** Leads that have never been scored, oldest first. */
export const listLeadsToScore = query({
  args: { secret: v.string(), orgId: v.id("organizations"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    const rows = await ctx.db
      .query("crmLeads")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return rows
      .filter((r) => r.aiUpdatedAt === undefined && r.status !== "converted")
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, Math.min(Math.max(args.limit ?? 10, 1), 25));
  },
});