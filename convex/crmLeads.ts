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
