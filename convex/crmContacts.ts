import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, requireOrg, requireMember, tsNow } from "./lib";
import { requireOptionalRef } from "./crmLib";

function clean(s?: string | null): string | undefined {
  const t = (s ?? "").trim();
  return t.length ? t : undefined;
}

export const listContacts = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    companyId: v.optional(v.id("crmCompanies")),
    q: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    const rows = await ctx.db
      .query("crmContacts")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const needle = args.q?.trim().toLowerCase();
    return rows
      .filter((r) => (args.companyId ? r.companyId === args.companyId : true))
      .filter((r) =>
        needle
          ? r.name.toLowerCase().includes(needle) ||
            (r.email ?? "").toLowerCase().includes(needle)
          : true
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const getContact = query({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("crmContacts") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) return null;
    return doc;
  },
});

export const createContact = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    companyId: v.optional(v.id("crmCompanies")),
    name: v.string(),
    title: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    linkedin: v.optional(v.string()),
    notes: v.optional(v.string()),
    ownerId: v.optional(v.id("users")),
    accountingContactId: v.optional(v.id("contacts")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const name = args.name.trim();
    if (!name) throw new Error("Contact name is required");
    if (args.companyId) await requireOptionalRef(ctx, args.orgId, args.companyId, "Company");
    if (args.ownerId) await requireOptionalRef(ctx, args.orgId, args.ownerId, "Owner");
    if (args.accountingContactId) {
      await requireOptionalRef(ctx, args.orgId, args.accountingContactId, "Customer");
    }
    const now = tsNow();
    return ctx.db.insert("crmContacts", {
      orgId: args.orgId,
      companyId: args.companyId,
      name,
      title: clean(args.title),
      email: clean(args.email),
      phone: clean(args.phone),
      linkedin: clean(args.linkedin),
      notes: clean(args.notes),
      ownerId: args.ownerId,
      accountingContactId: args.accountingContactId,
      createdBy: args.actorId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateContact = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmContacts"),
    companyId: v.optional(v.union(v.id("crmCompanies"), v.null())),
    name: v.optional(v.string()),
    title: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    linkedin: v.optional(v.string()),
    notes: v.optional(v.string()),
    ownerId: v.optional(v.union(v.id("users"), v.null())),
    accountingContactId: v.optional(v.union(v.id("contacts"), v.null())),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Contact not found");

    const patch: Record<string, unknown> = { updatedAt: tsNow() };
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Contact name is required");
      patch.name = name;
    }
    if (args.title !== undefined) patch.title = clean(args.title);
    if (args.email !== undefined) patch.email = clean(args.email);
    if (args.phone !== undefined) patch.phone = clean(args.phone);
    if (args.linkedin !== undefined) patch.linkedin = clean(args.linkedin);
    if (args.notes !== undefined) patch.notes = clean(args.notes);
    if (args.companyId !== undefined) {
      if (args.companyId !== null) await requireOptionalRef(ctx, args.orgId, args.companyId, "Company");
      patch.companyId = args.companyId ?? undefined;
    }
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

export const deleteContact = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("crmContacts"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Contact not found");
    await ctx.db.delete(args.id);
    return true;
  },
});
