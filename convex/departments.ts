import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { assertSecret, tsNow } from "./lib";

/**
 * Company departments and employee allocation.
 *
 * Departments are scoped to an organization. Destroying a department clears
 * the `departmentId` on every employee assigned to it (no dangling pointers),
 * but never deletes the employees themselves.
 */

export const listDepartments = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const depts = await ctx.db
      .query("departments")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const members = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const byDept = new Map<string, typeof members>();
    for (const u of members) {
      if (!u.departmentId) continue;
      const list = byDept.get(u.departmentId.toString()) ?? [];
      list.push(u);
      byDept.set(u.departmentId.toString(), list);
    }

    return depts
      .map((d) => {
        const people = (byDept.get(d._id.toString()) ?? []).sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        return {
          id: d._id,
          name: d.name,
          createdAt: new Date(d.createdAt).toISOString().replace("T", " ").slice(0, 10),
          memberCount: people.length,
          members: people.map((u) => ({
            id: u._id,
            name: u.name,
            role: u.role,
          })),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** All active employees, grouped by their current department (nullable). */
export const listEmployees = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const users = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return users
      .filter((u) => u.active)
      .map((u) => ({
        id: u._id,
        name: u.name,
        role: u.role,
        departmentId: u.departmentId ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createDepartment = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const name = args.name.trim();
    if (!name) throw new ConvexError("Department name is required");
    if (name.length > 60) throw new ConvexError("Department name must be 60 characters or fewer");

    const existing = await ctx.db
      .query("departments")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    if (existing.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
      throw new ConvexError("A department with that name already exists");
    }

    return ctx.db.insert("departments", {
      orgId: args.orgId,
      name,
      createdAt: tsNow(),
    });
  },
});

export const renameDepartment = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("departments"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const dept = await ctx.db.get(args.id);
    if (!dept || dept.orgId !== args.orgId) throw new ConvexError("Department not found");

    const name = args.name.trim();
    if (!name) throw new ConvexError("Department name is required");
    if (name.length > 60) throw new ConvexError("Department name must be 60 characters or fewer");

    const siblings = await ctx.db
      .query("departments")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    if (
      siblings.some((d) => d._id.toString() !== args.id.toString() && d.name.toLowerCase() === name.toLowerCase())
    ) {
      throw new ConvexError("A department with that name already exists");
    }

    await ctx.db.patch(args.id, { name });
    return true;
  },
});

export const deleteDepartment = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("departments"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const dept = await ctx.db.get(args.id);
    if (!dept || dept.orgId !== args.orgId) throw new ConvexError("Department not found");

    const members = await ctx.db
      .query("users")
      .withIndex("by_org_department", (q) =>
        q.eq("orgId", args.orgId).eq("departmentId", args.id)
      )
      .collect();
    for (const u of members) {
      await ctx.db.patch(u._id, { departmentId: undefined });
    }

    await ctx.db.delete(args.id);
    return { movedTo: members.length };
  },
});

export const setUserDepartment = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.id("users"),
    departmentId: v.union(v.id("departments"), v.null()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const user = await ctx.db.get(args.userId);
    if (!user || user.orgId !== args.orgId) throw new ConvexError("User not found");

    if (args.departmentId) {
      const dept = await ctx.db.get(args.departmentId);
      if (!dept || dept.orgId !== args.orgId) throw new ConvexError("Department not found");
    }

    await ctx.db.patch(args.userId, {
      departmentId: args.departmentId ?? undefined,
    });
    return true;
  },
});
