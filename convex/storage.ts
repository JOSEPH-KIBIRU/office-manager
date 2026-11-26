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
    scanStatus: v.optional(
      v.union(v.literal("pending"), v.literal("clean"), v.literal("infected"), v.literal("error"))
    ),
    scanReason: v.optional(v.string()),
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
      scanStatus: args.scanStatus ?? "pending",
      scanReason: args.scanReason,
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
      return {
        url: row.url ?? "",
        name: row.name ?? null,
        type: row.type ?? null,
        kind: row.kind,
        encrypted: !!row.encrypted,
        encKeyEnc: row.encKeyEnc ?? null,
        encIv: row.encIv ?? null,
        scanStatus: row.scanStatus ?? null,
        scanReason: row.scanReason ?? null,
      };
    }

    // Files uploaded before the registry was added are still resolvable from
    // their owning record (documents, minutes, company logo).
    const doc = await ctx.db
      .query("documents")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.eq(q.field("fileKey"), args.key))
      .first();
    if (doc?.fileUrl && /^https:\/\//i.test(doc.fileUrl)) {
      return {
        url: doc.fileUrl,
        name: doc.fileName ?? null,
        type: null,
        kind: "other",
        encrypted: false,
        encKeyEnc: null,
        encIv: null,
        scanStatus: null,
        scanReason: null,
      };
    }

    const minute = await ctx.db
      .query("minutes")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.eq(q.field("fileKey"), args.key))
      .first();
    if (minute?.fileUrl && /^https:\/\//i.test(minute.fileUrl)) {
      return {
        url: minute.fileUrl,
        name: minute.fileName ?? null,
        type: null,
        kind: "minutes",
        encrypted: false,
        encKeyEnc: null,
        encIv: null,
        scanStatus: null,
        scanReason: null,
      };
    }

    const org = await ctx.db.get(args.orgId);
    if (org?.logoKey === args.key && org.logoUrl && /^https:\/\//i.test(org.logoUrl)) {
      return {
        url: org.logoUrl,
        name: "logo",
        type: null,
        kind: "logo",
        encrypted: false,
        encKeyEnc: null,
        encIv: null,
        scanStatus: null,
        scanReason: null,
      };
    }

    return null;
  },
});

/**
 * Attach client-side encryption metadata to a freshly uploaded file. The AES
 * key is encrypted with TOKEN_ENCRYPTION_KEY before it reaches Convex.
 */
export const setFileEncryption = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    key: v.string(),
    encKeyEnc: v.string(),
    encIv: v.string(),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    scanStatus: v.optional(
      v.union(v.literal("pending"), v.literal("clean"), v.literal("infected"), v.literal("error"))
    ),
    scanReason: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const row = await ctx.db
      .query("storedFiles")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (!row || row.orgId !== args.orgId) throw new Error("File not found");
    await ctx.db.patch(row._id, {
      encrypted: true,
      encKeyEnc: args.encKeyEnc,
      encIv: args.encIv,
      name: args.name ?? row.name,
      type: args.type ?? row.type,
      scanStatus: args.scanStatus ?? row.scanStatus,
      scanReason: args.scanReason ?? undefined,
    });
    return true;
  },
});

/** Record a scan outcome (clean / infected / scanner error). */
export const setFileScanStatus = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    key: v.string(),
    status: v.union(v.literal("clean"), v.literal("infected"), v.literal("error")),
    reason: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const row = await ctx.db
      .query("storedFiles")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (!row || row.orgId !== args.orgId) throw new Error("File not found");
    await ctx.db.patch(row._id, {
      scanStatus: args.status,
      scanReason: args.reason ?? undefined,
    });
    return true;
  },
});

/**
 * Resolve an org-owned storage id to a URL plus its file kind. Legacy files
 * (uploaded before the registry existed) are honoured when the blob is
 * referenced by the org's own logo or minutes and is not registered to another
 * organization.
 */
async function resolveFileForStorage(ctx: any, orgId: any, id: any) {
  const row = await ctx.db
    .query("storedFiles")
    .withIndex("by_storage", (q: any) => q.eq("storageId", id))
    .first();
  if (row) {
    if (row.orgId !== orgId) return null;
    const url = row.url ?? (row.storageId ? await ctx.storage.getUrl(row.storageId) : null);
    return url ? { url, kind: row.kind as string } : null;
  }

  const org = await ctx.db.get(orgId);
  if (org && org.logoFileId === id) {
    return { url: await ctx.storage.getUrl(id), kind: "logo" };
  }
  const minute = await ctx.db
    .query("minutes")
    .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
    .filter((q: any) => q.eq(q.field("fileId"), id))
    .first();
  if (minute) {
    return { url: await ctx.storage.getUrl(id), kind: "minutes" };
  }
  return null;
}

/** Backwards-compatible URL lookup used by older clients. */
export const getFileUrl = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("_storage") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const file = await resolveFileForStorage(ctx, args.orgId, args.id);
    return file?.url ?? null;
  },
});

/** URL lookup plus the file kind, used to enforce module-level access. */
export const getFileWithKind = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("_storage") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    return await resolveFileForStorage(ctx, args.orgId, args.id);
  },
});
