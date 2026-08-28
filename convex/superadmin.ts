import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, tsNow } from "./lib";
import { slugify } from "./orgs";

/** Only platform super_admins may reach these. Verifies the caller account. */
async function assertSuperAdmin(ctx: any, superAdminId: string) {
  const sa = await ctx.db.get(superAdminId);
  if (!sa || sa.role !== "super_admin" || !sa.active) {
    throw new Error("Platform owner access required");
  }
  return sa;
}

export const listAllOrganizations = query({
  args: { secret: v.string(), superAdminId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const orgs = await ctx.db.query("organizations").collect();
    const result = [] as Array<{
      id: string;
      name: string;
      slug: string;
      active: boolean;
      users: number;
      admins: string[];
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
        admins: users.filter((u) => u.role === "admin").map((u) => u.name),
        created_at: new Date(o.createdAt).toISOString().replace("T", " ").slice(0, 19),
      });
    }
    return result;
  },
});

/** Platform owner creates a new company org and its first admin account. */
export const createCompany = mutation({
  args: {
    secret: v.string(),
    superAdminId: v.id("users"),
    name: v.string(),
    adminName: v.string(),
    adminEmail: v.string(),
    adminPasswordHash: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const sa = await assertSuperAdmin(ctx, args.superAdminId);
    void sa;

    const slug = slugify(args.name);
    const existingOrg = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existingOrg) throw new Error(`An organization with slug "${slug}" already exists`);

    const email = args.adminEmail.toLowerCase().trim();
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existingUser) throw new Error("A user with this email already exists");

    const orgId = await ctx.db.insert("organizations", {
      name: args.name,
      slug,
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

    return { orgId, adminId, adminEmail: email };
  },
});

export const setCompanyActive = mutation({
  args: {
    secret: v.string(),
    superAdminId: v.id("users"),
    orgId: v.id("organizations"),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    await ctx.db.patch(args.orgId, { active: args.active });
    return { orgId: args.orgId, active: args.active };
  },
});
