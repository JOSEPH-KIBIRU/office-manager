import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, tsNow } from "./lib";

export const generateUploadUrl = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Register a freshly-uploaded blob as belonging to an organization. Idempotent.
 * Every file served through /api/files must first be registered here so that
 * tenants can only ever fetch blobs they own.
 */
export const registerFile = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    storageId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
    key: v.optional(v.string()),
    name: v.optional(v.string()),
    size: v.optional(v.number()),
    type: v.optional(v.string()),
    kind: v.union(v.literal("logo"), v.literal("minutes"), v.literal("task"), v.literal("other")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    if (args.storageId) {
      const existing = await ctx.db
        .query("storedFiles")
        .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
        .first();
      if (existing) return true;
    }
    if (args.key) {
      const existing = await ctx.db
        .query("storedFiles")
        .withIndex("by_key", (q) => q.eq("key", args.key))
        .first();
      if (existing) return true;
    }
    await ctx.db.insert("storedFiles", {
      orgId: args.orgId,
      storageId: args.storageId,
      url: args.url,
      key: args.key,
      name: args.name,
      size: args.size,
      type: args.type,
      kind: args.kind,
      createdAt: tsNow(),
    });
    return true;
  },
});

/**
 * Resolve an UploadThing file key for the authenticated organization. Returns
 * the CDN URL only to server-side callers (the file proxy), never to clients.
 */
export const getFileByKey = query({
  args: { secret: v.string(), orgId: v.id("organizations"), key: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const row = await ctx.db
      .query("storedFiles")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (row) {
      if (row.orgId !== args.orgId) return null;
      return { url: row.url ?? "", name: row.name ?? null, type: row.type ?? null };
    }

    // Files uploaded before the registry was added are still resolvable from
    // their owning record (documents, minutes, company logo).
    const doc = await ctx.db
      .query("documents")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.eq(q.field("fileKey"), args.key))
      .first();
    if (doc?.fileUrl && /^https:\/\//i.test(doc.fileUrl)) {
      return { url: doc.fileUrl, name: doc.fileName ?? null, type: null };
    }

    const minute = await ctx.db
      .query("minutes")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.eq(q.field("fileKey"), args.key))
      .first();
    if (minute?.fileUrl && /^https:\/\//i.test(minute.fileUrl)) {
      return { url: minute.fileUrl, name: minute.fileName ?? null, type: null };
    }

    const org = await ctx.db.get(args.orgId);
    if (org?.logoKey === args.key && org.logoUrl && /^https:\/\//i.test(org.logoUrl)) {
      return { url: org.logoUrl, name: "logo", type: null };
    }

    return null;
  },
});

/**
 * Org-scoped file URL lookup. Returns a signed URL only when the blob belongs
 * to the requesting organization. Legacy files (uploaded before the registry
 * existed) are honoured when the blob is referenced by the org's own logo or
 * minutes and is not registered to another organization.
 */
export const getFileUrl = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("_storage") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const row = await ctx.db
      .query("storedFiles")
      .withIndex("by_storage", (q) => q.eq("storageId", args.id))
      .first();
    if (row) {
      if (row.orgId !== args.orgId) return null;
      if (row.url) return row.url;
      return row.storageId ? await ctx.storage.getUrl(row.storageId) : null;
    }

    // Legacy fallback: not yet registered to any org, but referenced by this org.
    const org = await ctx.db.get(args.orgId);
    if (org && org.logoFileId === args.id) return await ctx.storage.getUrl(args.id);
    const minute = await ctx.db
      .query("minutes")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.eq(q.field("fileId"), args.id))
      .first();
    if (minute) return await ctx.storage.getUrl(args.id);
    return null;
  },
});
