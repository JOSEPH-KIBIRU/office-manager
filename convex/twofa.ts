import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, requireMember, tsNow } from "./lib";

export const status = query({
  args: { secret: v.string(), orgId: v.id("organizations"), userId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const u = await requireMember(ctx, args.orgId, args.userId);
    return {
      enabled: !!u.twoFactorEnabledAt,
      recovery_count: (u.twoFactorRecoveryHashes ?? []).length,
    };
  },
});

export const setPendingSecret = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), userId: v.id("users"), twoFactorSecret: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.userId);
    await ctx.db.patch(args.userId, { twoFactorSecret: args.twoFactorSecret });
    return true;
  },
});

export const enable = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.id("users"),
    recoveryHashes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.userId);
    await ctx.db.patch(args.userId, {
      twoFactorEnabledAt: tsNow(),
      twoFactorRecoveryHashes: args.recoveryHashes,
    });
    return true;
  },
});

export const disable = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), userId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.userId);
    await ctx.db.patch(args.userId, {
      twoFactorSecret: undefined,
      twoFactorEnabledAt: undefined,
      twoFactorRecoveryHashes: undefined,
    });
    return true;
  },
});

export const setRecoveryHashes = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.id("users"),
    recoveryHashes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.userId);
    await ctx.db.patch(args.userId, { twoFactorRecoveryHashes: args.recoveryHashes });
    return true;
  },
});
