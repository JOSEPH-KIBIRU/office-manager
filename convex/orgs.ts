import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, tsNow } from "./lib";

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "org";
}

/** Platform owner: register a new tenant with its first admin account. */
export const createOrganization = mutation({
  args: {
    secret: v.string(),
    name: v.string(),
    slug: v.string(),
    adminName: v.string(),
    adminEmail: v.string(),
    adminPasswordHash: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);

    const existingOrg = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existingOrg) throw new Error(`An organization with slug "${args.slug}" already exists`);

    const email = args.adminEmail.toLowerCase().trim();
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existingUser) throw new Error("A user with this email already exists");

    const orgId = await ctx.db.insert("organizations", {
      name: args.name,
      slug: args.slug,
      active: true,
      createdAt: tsNow(),
    });

    const adminId = await ctx.db.insert("users", {
      orgId,
      name: args.adminName,
      email,
      role: "admin",
      passwordHash: args.adminPasswordHash,
      leaveBalance: 21,
      mustChangePassword: true,
      active: true,
      createdAt: tsNow(),
    });

    return { orgId, adminId };
  },
});

export const listOrganizations = query({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const orgs = await ctx.db.query("organizations").collect();
    const result = [] as Array<{
      id: string;
      name: string;
      slug: string;
      active: boolean;
      users: number;
      created_at: string;
    }>;
    for (const o of [...orgs].sort((a, b) => a.createdAt - b.createdAt)) {
      const users = await ctx.db
        .query("users")
        .withIndex("by_org", (q) => q.eq("orgId", o._id))
        .collect();
      result.push({
        id: o._id,
        name: o.name,
        slug: o.slug,
        active: o.active,
        users: users.length,
        created_at: new Date(o.createdAt).toISOString().replace("T", " ").slice(0, 19),
      });
    }
    return result;
  },
});

export const setOrganizationActive = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), active: v.boolean() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await ctx.db.patch(args.orgId, { active: args.active });
    return true;
  },
});
