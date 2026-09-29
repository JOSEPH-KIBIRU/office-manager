import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret } from "./lib";

export const getUserByEmail = query({
  args: { secret: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    return ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase().trim()))
      .unique();
  },
});

/**
 * Org-scoped user fetch: refuses users that belong to a different organization.
 * `orgId` is mandatory so callers can never do an unscoped, cross-tenant read.
 */
export const getUserById = query({
  args: {
    secret: v.string(),
    id: v.id("users"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const user = await ctx.db.get(args.id);
    if (!user) return null;
    if (user.orgId !== args.orgId) return null;
    return user;
  },
});

export const getActiveAdmins = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    return ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) =>
        q.and(q.eq(q.field("role"), "admin"), q.eq(q.field("active"), true))
      )
      .collect();
  },
});

/** Record a successful login so superadmins can see last access per company. */
export const recordLogin = mutation({
  args: { secret: v.string(), userId: v.id("users"), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const user = await ctx.db.get(args.userId);
    if (!user || user.orgId !== args.orgId) return { ok: false };
    const now = Date.now();
    await ctx.db.patch(user._id, { lastLoginAt: now });
    const org = await ctx.db.get(args.orgId);
    if (org) await ctx.db.patch(org._id, { lastAccessedAt: now });
    return { ok: true };
  },
});
