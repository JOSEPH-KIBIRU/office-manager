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

/** Org-scoped user fetch: refuses users that belong to a different organization. */
export const getUserById = query({
  args: {
    secret: v.string(),
    id: v.id("users"),
    orgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const user = await ctx.db.get(args.id);
    if (!user) return null;
    if (args.orgId && user.orgId !== args.orgId) return null;
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
