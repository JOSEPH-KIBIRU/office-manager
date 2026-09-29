import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, tsNow } from "./lib";
import { assertSuperAdmin } from "./superadmin";
import { buildOrgExport } from "./orgData";

const kindValidator = v.union(v.literal("manual"), v.literal("pre_delete"), v.literal("pre_restore"));

/** Internal: build the export payload (used by the snapshot action). */
export const exportPayload = internalQuery({
  args: { secret: v.string(), superAdminId: v.id("users"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    return await buildOrgExport(ctx, args.orgId);
  },
});

/** Internal: persist a snapshot record once the file has been stored. */
export const recordSnapshot = internalMutation({
  args: {
    secret: v.string(),
    superAdminId: v.id("users"),
    orgId: v.id("organizations"),
    kind: kindValidator,
    storageId: v.id("_storage"),
    size: v.number(),
    counts: v.any(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Company not found");
    const id = await ctx.db.insert("backups", {
      orgId: args.orgId,
      orgName: org.name,
      kind: args.kind,
      storageId: args.storageId,
      size: args.size,
      counts: args.counts,
      createdBy: args.superAdminId,
      createdAt: tsNow(),
    });
    return { id };
  },
});
