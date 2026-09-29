import { mutation } from "./_generated/server";
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
    storageId: v.id("_storage"),
    kind: v.union(v.literal("logo"), v.literal("minutes"), v.literal("task"), v.literal("other")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const existing = await ctx.db
      .query("storedFiles")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .first();
    if (existing) return true;
    await ctx.db.insert("storedFiles", {
      orgId: args.orgId,
      storageId: args.storageId,
      kind: args.kind,
      createdAt: tsNow(),
    });
    return true;
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
    if (row) return row.orgId === args.orgId ? await ctx.storage.getUrl(args.id) : null;

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
