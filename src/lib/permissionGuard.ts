import "server-only";
import { getSession, HttpError } from "./auth";
import type { SessionPayload } from "./types";
import { cx, secret, api } from "./convex";
import { resolveRolePermissions, ALL_MODULE_KEYS, ORG_ROLES, type OrgRole } from "./permissions";

type Access = { enabled: string[] | null; granted: string[] | null };

const BUILTIN_ROLES = new Set<string>([...ORG_ROLES, "super_admin"]);

/** Resolve the platform cap + configured grants for a role in one round-trip. */
async function resolveAccess(orgId: string, role: string): Promise<Access> {
  return (await cx().query(api.permissions.resolveAccess, {
    secret: secret(),
    orgId: orgId as never,
    role,
  })) as Access;
}

/** Intersect a base module list with the platform cap (null = unrestricted). */
function capByEnabled(base: string[], enabled: string[] | null): string[] {
  if (!enabled) return base;
  return base.filter((m) => enabled.includes(m));
}

/**
 * Effective grants for display (sidebar, config page): the role's defaults (or
 * saved grants) intersected with the platform feature cap.
 */
export async function getEffectivePermissions(orgId: string, role: string): Promise<string[]> {
  if (role === "admin") {
    const { enabled } = await resolveAccess(orgId, role);
    return capByEnabled([...ALL_MODULE_KEYS], enabled);
  }
  const { enabled, granted } = await resolveAccess(orgId, role);
  const base = granted ?? resolveRolePermissions(role as OrgRole, {});
  return capByEnabled(base, enabled);
}

/**
 * Module-level access guard.
 *
 * Rules:
 *   - the module must be within the platform cap (applies to every role,
 *     including admin — a disabled module is fully masked);
 *   - an admin (Director) always has full access;
 *   - a company-defined (custom) role is allowed only when the module is granted;
 *   - a built-in role that has saved permissions is governed by those grants
 *     (they may extend *or* restrict beyond the default role list);
 *   - a built-in role with no saved permissions keeps the legacy coarse role gate
 *     (`fallbackRoles`).
 */
export async function requirePermission(
  module: string,
  fallbackRoles: string[]
): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || !session.orgId) throw new HttpError(401, "Not authenticated");
  if (session.role === "super_admin") return session;

  const { enabled, granted } = await resolveAccess(session.orgId, session.role);
  const isCustom = !BUILTIN_ROLES.has(session.role);

  // Platform cap — the hard ceiling for every role, admin included.
  if (enabled && !enabled.includes(module)) {
    throw new HttpError(403, "This module is not available on your plan");
  }
  if (session.role === "admin") return session;

  // Custom roles and configured built-in roles are grant-driven.
  if (isCustom || Array.isArray(granted)) {
    if (!Array.isArray(granted) || !granted.includes(module)) {
      throw new HttpError(403, "You do not have permission to access this module");
    }
    return session;
  }

  // Unconfigured built-in role — legacy coarse role gate.
  if (!fallbackRoles.includes(session.role)) {
    throw new HttpError(403, "You do not have permission to perform this action");
  }
  return session;
}
