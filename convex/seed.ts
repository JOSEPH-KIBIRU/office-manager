import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, tsNow } from "./lib";

/**
 * Idempotent app bootstrap. Creates the default organization (from ORG_NAME env,
 * falling back to a sensible name) and seeds the director account from
 * ADMIN_* env vars when the org has no users.
 */
export const ensureAppInit = mutation({
  args: {
    secret: v.string(),
    orgName: v.string(),
    adminName: v.string(),
    adminEmail: v.string(),
    adminPasswordHash: v.string(),
    superAdminEmail: v.optional(v.string()),
    superAdminName: v.optional(v.string()),
    superAdminPasswordHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);

    // Platform org holds superadmin accounts only.
    let platformOrg = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", "__platform"))
      .unique();
    if (!platformOrg) {
      const platformOrgId = await ctx.db.insert("organizations", {
        name: "__platform__",
        slug: "__platform",
        active: true,
        createdAt: tsNow(),
      });
      platformOrg = await ctx.db.get(platformOrgId);
    }
    if (!platformOrg) throw new Error("Failed to create platform organization");

    if (args.superAdminEmail && args.superAdminPasswordHash) {
      const email = args.superAdminEmail.toLowerCase().trim();
      const existingSuper = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (!existingSuper) {
        await ctx.db.insert("users", {
          orgId: platformOrg._id,
          name: args.superAdminName || "Platform Owner",
          email,
          role: "super_admin",
          platformRole: "platform_owner",
          passwordHash: args.superAdminPasswordHash,
          leaveBalance: 0,
          mustChangePassword: false,
          active: true,
          createdAt: tsNow(),
        });
      }
    }

    let org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", "default"))
      .unique();

    if (!org) {
      const orgId = await ctx.db.insert("organizations", {
        name: args.orgName || "Office",
        slug: "default",
        active: true,
        createdAt: tsNow(),
      });
      org = await ctx.db.get(orgId);
    }
    if (!org) throw new Error("Failed to create default organization");

    const existingUsers = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", org!._id))
      .first();

    if (!existingUsers) {
      await ctx.db.insert("users", {
        orgId: org._id,
        name: args.adminName,
        email: args.adminEmail.toLowerCase().trim(),
        role: "admin",
        passwordHash: args.adminPasswordHash,
        leaveBalance: 21,
        mustChangePassword: false,
        active: true,
        createdAt: tsNow(),
      });
    }

    return true;
  },
});
