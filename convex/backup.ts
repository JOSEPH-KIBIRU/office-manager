import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret } from "./lib";
import { assertSuperAdmin } from "./superadmin";
import { buildOrgExport } from "./orgData";
import { internal } from "./_generated/api";

const kindValidator = v.union(v.literal("manual"), v.literal("pre_delete"), v.literal("pre_restore"));

/** Immediate, non-persisted export of a company's full dataset (for download). */
export const exportCompanyJson = query({
  args: { secret: v.string(), superAdminId: v.id("users"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    return await buildOrgExport(ctx, args.orgId);
  },
});

/**
 * Persist a point-in-time snapshot of a company into Convex storage.
 * Implemented as an action because only actions may write Blobs to storage.
 */
export const createSnapshot = action({
  args: {
    secret: v.string(),
    superAdminId: v.id("users"),
    orgId: v.id("organizations"),
    kind: v.optional(kindValidator),
  },
  handler: async (ctx, args): Promise<{ id: string; size: number; counts: Record<string, number> }> => {
    const payload = await ctx.runQuery(internal.backupInternals.exportPayload, {
      secret: args.secret,
      superAdminId: args.superAdminId,
      orgId: args.orgId,
    });
    const json = JSON.stringify(payload);
    const storageId = await ctx.storage.store(new Blob([json], { type: "application/json" }));
    const res = await ctx.runMutation(internal.backupInternals.recordSnapshot, {
      secret: args.secret,
      superAdminId: args.superAdminId,
      orgId: args.orgId,
      kind: args.kind ?? "manual",
      storageId,
      size: json.length,
      counts: payload.meta.counts,
    });
    return { id: res.id, size: json.length, counts: payload.meta.counts };
  },
});

/** List stored snapshots for a company, newest first, with download URLs. */
export const listSnapshots = query({
  args: { secret: v.string(), superAdminId: v.id("users"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const rows = await ctx.db
      .query("backups")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const out = [] as Array<{
      id: string;
      kind: string;
      size: number;
      counts: unknown;
      createdAt: number;
      url: string | null;
    }>;
    for (const b of rows) {
      let url: string | null = null;
      try {
        url = await ctx.storage.getUrl(b.storageId);
      } catch {
        url = null;
      }
      out.push({ id: b._id, kind: b.kind, size: b.size, counts: b.counts, createdAt: b.createdAt, url });
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Delete a stored snapshot (and its underlying file). */
export const deleteSnapshot = mutation({
  args: { secret: v.string(), superAdminId: v.id("users"), id: v.id("backups") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const b = await ctx.db.get(args.id);
    if (!b) throw new Error("Backup not found");
    try {
      await ctx.storage.delete(b.storageId);
    } catch {
      /* ignore missing file */
    }
    await ctx.db.delete(args.id);
    return { id: args.id };
  },
});
