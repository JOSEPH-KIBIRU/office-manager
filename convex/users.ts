import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { assertSecret, tsNow } from "./lib";
import { seedDefaultsForUser } from "./checklists";

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
      bank_name: u.bankName ?? null,
      bank_account: u.bankAccount ?? null,
      mpesa_number: u.mpesaNumber ?? null,
      employment_type: u.employmentType ?? "permanent",
      helb_deduction: u.helbDeduction ?? null,
      department_id: u.departmentId ?? null,
      terms_agreed_at: u.termsAgreedAt ?? null,
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
    employmentType: v.optional(
      v.union(v.literal("permanent"), v.literal("permanent_pensionable"))
    ),
    bankName: v.optional(v.string()),
    bankAccount: v.optional(v.string()),
    mpesaNumber: v.optional(v.string()),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    // Email is the global login key — must be unique platform-wide.
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existing) throw new ConvexError("A user with this email already exists");

    const id = await ctx.db.insert("users", {
      orgId: args.orgId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      role: args.role,
      employmentType: args.employmentType ?? "permanent",
      bankName: args.bankName?.trim() || undefined,
      bankAccount: args.bankAccount?.trim() || undefined,
      mpesaNumber: args.mpesaNumber?.trim() || undefined,
      passwordHash: args.passwordHash,
      leaveBalance: 21,
      mustChangePassword: true,
      active: true,
      createdAt: tsNow(),
    });
    // Kick off the onboarding checklist the moment the account is created.
    await seedDefaultsForUser(ctx, args.orgId, id, "onboarding");
    return id;
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
    employmentType: v.optional(
      v.union(v.literal("permanent"), v.literal("permanent_pensionable"))
    ),
    helbDeduction: v.optional(v.number()),
    bankName: v.optional(v.string()),
    bankAccount: v.optional(v.string()),
    mpesaNumber: v.optional(v.string()),
    departmentId: v.optional(v.union(v.id("departments"), v.null())),
    newPasswordHash: v.optional(v.string()),
    mustChangePassword: v.optional(v.boolean()),
    termsVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const user = await ctx.db.get(args.id);
    if (!user || user.orgId !== args.orgId) throw new ConvexError("User not found");

    const patch: Record<string, unknown> = {};
    if (args.role !== undefined) patch.role = args.role;
    if (args.active !== undefined) patch.active = args.active;
    if (args.name !== undefined) patch.name = args.name;
    if (args.phone !== undefined) patch.phone = args.phone || undefined;
    if (args.leaveBalance !== undefined) patch.leaveBalance = args.leaveBalance;
    if (args.employeeNumber !== undefined) patch.employeeNumber = args.employeeNumber || undefined;
    if (args.basicSalary !== undefined) patch.basicSalary = args.basicSalary;
    if (args.statutoryNumber !== undefined) patch.statutoryNumber = args.statutoryNumber || undefined;
    if (args.employmentType !== undefined) patch.employmentType = args.employmentType;
    if (args.helbDeduction !== undefined) patch.helbDeduction = args.helbDeduction || 0;
    if (args.bankName !== undefined) patch.bankName = args.bankName || undefined;
    if (args.bankAccount !== undefined) patch.bankAccount = args.bankAccount || undefined;
    if (args.mpesaNumber !== undefined) patch.mpesaNumber = args.mpesaNumber || undefined;
    if (args.email !== undefined) {
      const em = args.email.toLowerCase().trim();
      const existing = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", em))
        .first();
      if (existing && existing._id !== args.id) {
        throw new ConvexError("Email is already in use by another account");
      }
      patch.email = em;
    }
    if (args.departmentId !== undefined) {
      if (args.departmentId) {
        const dept = await ctx.db.get(args.departmentId);
        if (!dept || dept.orgId !== args.orgId) throw new ConvexError("Department not found");
      }
      patch.departmentId = args.departmentId ?? undefined;
    }
    if (args.newPasswordHash !== undefined) {
      patch.passwordHash = args.newPasswordHash;
      patch.mustChangePassword = args.mustChangePassword ?? true;
    }
    if (args.termsVersion !== undefined) patch.termsVersion = args.termsVersion || undefined;

    await ctx.db.patch(args.id, patch);
    // Keep checklists in step with the account state.
    if (args.active === false) await seedDefaultsForUser(ctx, args.orgId, args.id, "offboarding");
    else if (args.active === true) await seedDefaultsForUser(ctx, args.orgId, args.id, "onboarding");
    return true;
  },
});

export const removeUser = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const user = await ctx.db.get(args.id);
    if (!user || user.orgId !== args.orgId) throw new ConvexError("User not found");
    if (user.role === "admin") throw new ConvexError("Cannot delete an admin account");

    const leaves = await ctx.db
      .query("leaves")
      .withIndex("by_user", (q) => q.eq("userId", args.id))
      .first();
    if (leaves) {
      await ctx.db.patch(args.id, { active: false });
      await seedDefaultsForUser(ctx, args.orgId, args.id, "offboarding");
      return { deactivated: true };
    }
    await ctx.db.delete(args.id);
    return { deleted: true };
  },
});

export const setTermsAccepted = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    userId: v.id("users"),
    version: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const user = await ctx.db.get(args.userId);
    if (!user || user.orgId !== args.orgId) throw new ConvexError("User not found");
    await ctx.db.patch(args.userId, {
      termsAgreedAt: tsNow(),
      termsVersion: args.version ?? undefined,
    });
    return true;
  },
});
