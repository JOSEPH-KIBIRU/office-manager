import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, requireOrg, requireMember, tsNow } from "./lib";
import { requireOptionalRef } from "./crmLib";

function clean(s?: string | null): string | undefined {
  const t = (s ?? "").trim();
  return t.length ? t : undefined;
}

export const listCompanies = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    q: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    const rows = await ctx.db
      .query("crmCompanies")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const needle = args.q?.trim().toLowerCase();
    const filtered = needle
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(needle) ||
            (r.domain ?? "").toLowerCase().includes(needle)
        )
      : rows;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const getCompany = query({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("crmCompanies") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) return null;
    return doc;
  },
});

export const createCompany = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    name: v.string(),
    domain: v.optional(v.string()),
    industry: v.optional(v.string()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    notes: v.optional(v.string()),
    ownerId: v.optional(v.id("users")),
    accountingContactId: v.optional(v.id("contacts")),
    source: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const name = args.name.trim();
    if (!name) throw new Error("Company name is required");
    if (args.ownerId) await requireOptionalRef(ctx, args.orgId, args.ownerId, "Owner");
    if (args.accountingContactId) {
      await requireOptionalRef(ctx, args.orgId, args.accountingContactId, "Customer");
    }
    const now = tsNow();
    return ctx.db.insert("crmCompanies", {
      orgId: args.orgId,
      name,
      domain: clean(args.domain),
      industry: clean(args.industry),
      website: clean(args.website),
      phone: clean(args.phone),
      address: clean(args.address),
      city: clean(args.city),
      country: clean(args.country),
      notes: clean(args.notes),
      ownerId: args.ownerId,
      accountingContactId: args.accountingContactId,
      source: clean(args.source),
      active: args.active ?? true,
      createdBy: args.actorId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateCompany = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmCompanies"),
    name: v.optional(v.string()),
    domain: v.optional(v.string()),
    industry: v.optional(v.string()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    notes: v.optional(v.string()),
    ownerId: v.optional(v.union(v.id("users"), v.null())),
    accountingContactId: v.optional(v.union(v.id("contacts"), v.null())),
    source: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Company not found");

    const patch: Record<string, unknown> = { updatedAt: tsNow() };
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Company name is required");
      patch.name = name;
    }
    if (args.domain !== undefined) patch.domain = clean(args.domain);
    if (args.industry !== undefined) patch.industry = clean(args.industry);
    if (args.website !== undefined) patch.website = clean(args.website);
    if (args.phone !== undefined) patch.phone = clean(args.phone);
    if (args.address !== undefined) patch.address = clean(args.address);
    if (args.city !== undefined) patch.city = clean(args.city);
    if (args.country !== undefined) patch.country = clean(args.country);
    if (args.notes !== undefined) patch.notes = clean(args.notes);
    if (args.source !== undefined) patch.source = clean(args.source);
    if (args.active !== undefined) patch.active = args.active;
    if (args.ownerId !== undefined) {
      if (args.ownerId !== null) await requireOptionalRef(ctx, args.orgId, args.ownerId, "Owner");
      patch.ownerId = args.ownerId ?? undefined;
    }
    if (args.accountingContactId !== undefined) {
      if (args.accountingContactId !== null) {
        await requireOptionalRef(ctx, args.orgId, args.accountingContactId, "Customer");
      }
      patch.accountingContactId = args.accountingContactId ?? undefined;
    }

    await ctx.db.patch(args.id, patch);
    return true;
  },
});

export const deleteCompany = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmCompanies"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Company not found");

    // Never orphan contacts or deals — they must be reassigned or deleted first.
    const contact = await ctx.db
      .query("crmContacts")
      .withIndex("by_org_company", (q) => q.eq("orgId", args.orgId).eq("companyId", args.id))
      .first();
    if (contact) throw new Error("Reassign or delete this company's contacts first");
    const deal = await ctx.db
      .query("crmDeals")
      .withIndex("by_org_company", (q) => q.eq("orgId", args.orgId).eq("companyId", args.id))
      .first();
    if (deal) throw new Error("Reassign or delete this company's deals first");

    await ctx.db.delete(args.id);
    return true;
  },
});
