import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, tsNow } from "./lib";

const roleValidator = v.union(
  v.literal("admin"),
  v.literal("secretary"),
  v.literal("manager"),
  v.literal("employee")
);

export const listUsers = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    full: v.boolean(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const users = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name));
    if (!args.full) {
      return sorted
        .filter((u) => u.active)
        .map((u) => ({ id: u._id, name: u.name, role: u.role }));
    }
    return sorted.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone ?? null,
      role: u.role,
      leave_balance: u.leaveBalance,
      employee_number: u.employeeNumber ?? null,
      basic_salary: u.basicSalary ?? null,
      statutory_number: u.statutoryNumber ?? null,
      helb_deduction: u.helbDeduction ?? null,
      must_change_password: u.mustChangePassword ? 1 : 0,
      active: u.active ? 1 : 0,
      created_at: new Date(u.createdAt).toISOString().replace("T", " ").slice(0, 19),
    }));
  },
});

export const createUser = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    role: roleValidator,
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    // Email is the global login key — must be unique platform-wide.
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (existing) throw new Error("A user with this email already exists");

    return ctx.db.insert("users", {
      orgId: args.orgId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      role: args.role,
      passwordHash: args.passwordHash,
      leaveBalance: 21,
      mustChangePassword: true,
      active: true,
      createdAt: tsNow(),
    });
  },
});

export const patchUser = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("users"),
    role: v.optional(roleValidator),
    active: v.optional(v.boolean()),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    leaveBalance: v.optional(v.number()),
    employeeNumber: v.optional(v.string()),
    basicSalary: v.optional(v.number()),
    statutoryNumber: v.optional(v.string()),
    helbDeduction: v.optional(v.number()),
    newPasswordHash: v.optional(v.string()),
    mustChangePassword: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const user = await ctx.db.get(args.id);
    if (!user || user.orgId !== args.orgId) throw new Error("User not found");

    const patch: Record<string, unknown> = {};
    if (args.role !== undefined) patch.role = args.role;
    if (args.active !== undefined) patch.active = args.active;
    if (args.name !== undefined) patch.name = args.name;
    if (args.phone !== undefined) patch.phone = args.phone || undefined;
    if (args.leaveBalance !== undefined) patch.leaveBalance = args.leaveBalance;
    if (args.employeeNumber !== undefined) patch.employeeNumber = args.employeeNumber || undefined;
    if (args.basicSalary !== undefined) patch.basicSalary = args.basicSalary;
    if (args.statutoryNumber !== undefined) patch.statutoryNumber = args.statutoryNumber || undefined;
    if (args.helbDeduction !== undefined) patch.helbDeduction = args.helbDeduction || 0;
    if (args.newPasswordHash !== undefined) {
      patch.passwordHash = args.newPasswordHash;
      patch.mustChangePassword = args.mustChangePassword ?? true;
    }

    await ctx.db.patch(args.id, patch);
    return true;
  },
});

export const removeUser = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const user = await ctx.db.get(args.id);
    if (!user || user.orgId !== args.orgId) throw new Error("User not found");
    if (user.role === "admin") throw new Error("Cannot delete an admin account");

    const leaves = await ctx.db
      .query("leaves")
      .withIndex("by_user", (q) => q.eq("userId", args.id))
      .first();
    if (leaves) {
      await ctx.db.patch(args.id, { active: false });
      return { deactivated: true };
    }
    await ctx.db.delete(args.id);
    return { deleted: true };
  },
});
