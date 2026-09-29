import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret } from "./lib";
import { assertSuperAdmin } from "./superadmin";

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
 */

const ROLE_VALIDATOR = v.union(
  v.literal("admin"),
  v.literal("secretary"),
  v.literal("manager"),
  v.literal("employee")
);

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
    const roles = ["admin", "secretary", "manager", "employee"] as const;
    const out: Record<string, { granted: string[] | null; overridden: boolean }> = {};
    for (const role of roles) {
      out[role] = {
        granted: Array.isArray(configured[role]) ? configured[role] : null,
        overridden: Array.isArray(configured[role]),
      };
    }
    return { config: out, enabledModules: enabled };
  },
});

/** Persist the granted modules for one role (admin role is ignored). */
export const setRolePermissions = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    role: ROLE_VALIDATOR,
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const org = await ctx.db.get(args.orgId);
    if (!org || !org.active) throw new Error("Organization not found or inactive");
    if (args.role === "admin") throw new Error("The admin role always has full access");

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
      // Also trim any per-role grants that no longer exist? No: null = all.
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
