import { query, mutation, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { assertSecret, requireMember, tsNow } from "./lib";

const DAY = 86_400_000;

async function enrich(ctx: QueryCtx, d: Doc<"documents">) {
  const user = d.userId ? await ctx.db.get(d.userId) : null;
  const fileUrl = d.fileId ? await ctx.storage.getUrl(d.fileId) : null;
  return {
    id: d._id,
    userId: d.userId ?? null,
    userName: user?.name ?? null,
    title: d.title,
    category: d.category,
    issuedDate: d.issuedDate ?? null,
    expiryDate: d.expiryDate ?? null,
    fileName: d.fileName ?? null,
    fileUrl,
    notes: d.notes ?? null,
    createdAt: d.createdAt,
  };
}

export const listDocuments = query({
  args: { secret: v.string(), orgId: v.id("organizations"), viewerId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const viewer = await requireMember(ctx, args.orgId, args.viewerId);
    const all = await ctx.db
      .query("documents")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    // Employees only see their own documents (plus company-wide ones).
    const visible = viewer.role === "employee" ? all.filter((d) => !d.userId || d.userId === viewer._id) : all;
    const sorted = [...visible].sort((a, b) => {
      const ax = a.expiryDate ?? "9999-12-31";
      const bx = b.expiryDate ?? "9999-12-31";
      return ax < bx ? -1 : ax > bx ? 1 : 0;
    });
    return Promise.all(sorted.map((d) => enrich(ctx, d)));
  },
});

export const createDocument = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.optional(v.id("users")),
    title: v.string(),
    category: v.union(
      v.literal("contract"),
      v.literal("license"),
      v.literal("insurance"),
      v.literal("certificate"),
      v.literal("other")
    ),
    issuedDate: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    fileName: v.optional(v.string()),
    fileId: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    if (!args.title.trim()) throw new Error("Document title is required");
    return ctx.db.insert("documents", {
      orgId: args.orgId,
      userId: args.userId,
      title: args.title.trim(),
      category: args.category,
      issuedDate: args.issuedDate || undefined,
      expiryDate: args.expiryDate || undefined,
      fileName: args.fileName?.trim() || undefined,
      fileId: args.fileId,
      notes: args.notes?.trim() || undefined,
      createdAt: tsNow(),
      updatedAt: tsNow(),
    });
  },
});

export const updateDocument = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("documents"),
    userId: v.optional(v.union(v.id("users"), v.null())),
    title: v.optional(v.string()),
    category: v.optional(
      v.union(
        v.literal("contract"),
        v.literal("license"),
        v.literal("insurance"),
        v.literal("certificate"),
        v.literal("other")
      )
    ),
    issuedDate: v.optional(v.union(v.string(), v.null())),
    expiryDate: v.optional(v.union(v.string(), v.null())),
    notes: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Document not found");
    const patch: Record<string, unknown> = { updatedAt: tsNow() };
    if (args.userId !== undefined) patch.userId = args.userId ?? undefined;
    if (args.title !== undefined) patch.title = args.title.trim();
    if (args.category !== undefined) patch.category = args.category;
    if (args.issuedDate !== undefined) patch.issuedDate = (args.issuedDate ?? "") || undefined;
    if (args.expiryDate !== undefined) patch.expiryDate = (args.expiryDate ?? "") || undefined;
    if (args.notes !== undefined) patch.notes = (args.notes ?? "").trim() || undefined;
    await ctx.db.patch(args.id, patch);
    return true;
  },
});

export const deleteDocument = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("documents") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Document not found");
    if (doc.fileId) {
      try {
        await ctx.storage.delete(doc.fileId);
      } catch {
        /* ignore */
      }
    }
    await ctx.db.delete(args.id);
    return true;
  },
});

/** Documents expiring within `withinDays` (or already expired), across all orgs. */
export const expiringSoon = query({
  args: { secret: v.string(), withinDays: v.number(), now: v.number() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const today = new Date(args.now).toISOString().slice(0, 10);
    const cutoff = new Date(args.now + args.withinDays * DAY).toISOString().slice(0, 10);
    const rows = await ctx.db.query("documents").collect();
    const out: Array<{
      id: string;
      orgId: string;
      orgName: string;
      title: string;
      category: string;
      expiryDate: string;
      userName: string | null;
      expired: boolean;
    }> = [];
    for (const d of rows) {
      if (!d.expiryDate || d.expiryDate > cutoff) continue;
      if (d.remLastAt && args.now - d.remLastAt < 6 * DAY) continue;
      const org = await ctx.db.get(d.orgId);
      if (!org || !org.active) continue;
      const user = d.userId ? await ctx.db.get(d.userId) : null;
      out.push({
        id: d._id,
        orgId: d.orgId,
        orgName: org.name,
        title: d.title,
        category: d.category,
        expiryDate: d.expiryDate,
        userName: user?.name ?? null,
        expired: d.expiryDate < today,
      });
    }
    return out;
  },
});

export const markNotified = mutation({
  args: { secret: v.string(), id: v.id("documents") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await ctx.db.patch(args.id, { remLastAt: tsNow() });
    return true;
  },
});
