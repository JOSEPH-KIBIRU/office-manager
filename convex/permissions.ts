import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret } from "./lib";
import { assertSuperAdmin } from "./superadmin";
import { slugify } from "./orgs";

/**
 * Two-layer module access:
 *
 *  1. Platform cap (`organizations.enabledModules`) — set by the super admin.
 *     When present it is the hard ceiling: modules outside it are hidden from
 *     every role and cannot be granted in the company's permissions tab.
 *     Absent means "all modules enabled".
 *  2. Per-role grants (`organizations.rolePermissions`) — set by a company
 *     admin, always a subset of the platform cap. Roles with no entry keep
 *     their defaults.
 *
 * Besides the built-in roles (admin/secretary/manager/employee) a company may
 * define its own roles in `organizations.customRoles`; the same two-layer
 * rules apply to them.
 */

const BUILTIN_ROLES = ["admin", "secretary", "manager", "employee"];

/** Turn a role label into a stable, url-ish key. */
function roleKey(label: string): string {
  const k = slugify(label).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return k || "role";
}

/**
 * Resolve the platform cap and the configured grants for a role.
 * `enabled === null` means unrestricted (all modules). `granted === null` means
 * the role has no explicit override (defaults apply / legacy access).
 */
export const resolveAccess = query({
  args: { secret: v.string(), orgId: v.id("organizations"), role: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Organization not found");
    const enabled = Array.isArray(org.enabledModules) ? org.enabledModules : null;
    const configured = (org.rolePermissions ?? {}) as Record<string, string[]>;
    const granted =
      args.role === "admin"
        ? null
        : Array.isArray(configured[args.role])
          ? configured[args.role]
          : null;
    return { enabled, granted };
  },
});

/** Full matrix for the company permissions page (roles + platform cap). */
export const getPermissionsConfig = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Organization not found");
    const enabled = Array.isArray(org.enabledModules) ? org.enabledModules : null;
    const configured = (org.rolePermissions ?? {}) as Record<string, string[]>;
    const customRoles = (org.customRoles ?? []).filter(
      (r) => r && typeof r.key === "string" && typeof r.label === "string"
    );
    const roles = [...BUILTIN_ROLES, ...customRoles.map((r) => r.key)];
    const out: Record<string, { granted: string[] | null; overridden: boolean }> = {};
    for (const role of roles) {
      out[role] = {
        granted: Array.isArray(configured[role]) ? configured[role] : null,
        overridden: Array.isArray(configured[role]),
      };
    }
    return { config: out, enabledModules: enabled, customRoles };
  },
});

/** Persist the granted modules for one role (admin role is ignored). */
export const setRolePermissions = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    role: v.string(),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const org = await ctx.db.get(args.orgId);
    if (!org || !org.active) throw new Error("Organization not found or inactive");
    if (args.role === "admin") throw new Error("The admin role always has full access");

    const customKeys = (org.customRoles ?? []).map((r) => r.key);
    if (!BUILTIN_ROLES.includes(args.role) && !customKeys.includes(args.role)) {
      throw new Error("Unknown role");
    }

    // Never allow granting beyond the platform cap.
    const enabled = Array.isArray(org.enabledModules) ? org.enabledModules : null;
    let clean = Array.from(new Set(args.permissions)).filter((p) => p.length > 0);
    if (enabled) clean = clean.filter((p) => enabled.includes(p));

    const existing = { ...(org.rolePermissions ?? {}) } as Record<string, string[]>;
    existing[args.role] = clean;
    await ctx.db.patch(args.orgId, { rolePermissions: existing as never });
    return { role: args.role, granted: clean };
  },
});

/** Add a company-defined role. */
export const addCustomRole = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), label: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const org = await ctx.db.get(args.orgId);
    if (!org || !org.active) throw new Error("Organization not found or inactive");

    const label = args.label.trim();
    if (!label) throw new Error("Role name is required");
    const key = roleKey(label);
    if (BUILTIN_ROLES.includes(key)) throw new Error("That name matches a built-in role");

    const existing = org.customRoles ?? [];
    if (existing.some((r) => r.key === key)) throw new Error("That role already exists");

    const next = [...existing, { key, label }];
    await ctx.db.patch(args.orgId, { customRoles: next });
    return { key, label, customRoles: next };
  },
});

/** Remove a company-defined role and any permissions stored for it. */
export const removeCustomRole = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), key: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Organization not found");

    const next = (org.customRoles ?? []).filter((r) => r.key !== args.key);
    const configured = { ...(org.rolePermissions ?? {}) } as Record<string, string[]>;
    delete configured[args.key];
    await ctx.db.patch(args.orgId, { customRoles: next, rolePermissions: configured as never });
    return { customRoles: next };
  },
});

/** All companies with their platform feature cap (super admin). */
export const listCompaniesModules = query({
  args: { secret: v.string(), superAdminId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const orgs = await ctx.db.query("organizations").collect();
    return orgs
      .filter((o) => o.slug !== "__platform")
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((o) => ({
        id: o._id,
        name: o.name,
        active: o.active,
        enabledModules: Array.isArray(o.enabledModules) ? o.enabledModules : null,
      }));
  },
});

/** Set the platform feature cap for a company (super admin). `null` = all enabled. */
export const setEnabledModules = mutation({
  args: {
    secret: v.string(),
    superAdminId: v.id("users"),
    orgId: v.id("organizations"),
    modules: v.union(v.array(v.string()), v.null()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await assertSuperAdmin(ctx, args.superAdminId);
    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Company not found");

    if (args.modules === null) {
      await ctx.db.patch(args.orgId, { enabledModules: undefined });
      return { orgId: args.orgId, enabledModules: null };
    }

    const clean = Array.from(new Set(args.modules)).filter((m) => m.length > 0);
    await ctx.db.patch(args.orgId, { enabledModules: clean });

    // Cap existing per-role grants to the new enabled set so the company's
    // permissions tab never keeps a grant for a disabled module.
    const configured = { ...(org.rolePermissions ?? {}) } as Record<string, string[]>;
    let changed = false;
    for (const role of Object.keys(configured)) {
      const filtered = configured[role].filter((m) => clean.includes(m));
      if (filtered.length !== configured[role].length) {
        configured[role] = filtered;
        changed = true;
      }
    }
    if (changed) await ctx.db.patch(args.orgId, { rolePermissions: configured as never });

    return { orgId: args.orgId, enabledModules: clean };
  },
});
