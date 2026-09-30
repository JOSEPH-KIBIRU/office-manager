import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { ORG_ROLES, DEFAULT_ROLE_PERMISSIONS, type OrgRole } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";

/**
 * Fine-grained role permissions.
 * GET    /api/permissions - admin reads the full per-role matrix (+ custom roles).
 * PATCH  /api/permissions - admin sets the granted modules for one role.
 * POST   /api/permissions - admin adds/removes a company-defined role.
 *   body: { action: "addRole", label } | { action: "removeRole", key }
 */
const BUILTIN = new Set<string>(ORG_ROLES);

interface PermConfig {
  config: Record<string, { granted: string[] | null; overridden: boolean }>;
  enabledModules: string[] | null;
  customRoles: { key: string; label: string }[];
}

async function readConfig(orgId: string): Promise<PermConfig> {
  return (await cx().query(api.permissions.getPermissionsConfig, {
    secret: secret(),
    orgId: orgId as never,
  })) as PermConfig;
}

export async function GET() {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const res = await readConfig(session.orgId);

    const enabled = res.enabledModules;
    const roles = [...ORG_ROLES, ...res.customRoles.map((r) => r.key)];
    const config: Record<string, { granted: string[]; overridden: boolean }> = {};
    for (const role of roles) {
      const c = res.config[role] ?? { granted: null, overridden: false };
      const base = c.granted ?? (BUILTIN.has(role) ? DEFAULT_ROLE_PERMISSIONS[role as OrgRole] : []);
      // Never expose a grant for a module the platform has disabled.
      config[role] = {
        granted: enabled ? base.filter((m) => enabled.includes(m)) : base,
        overridden: c.overridden,
      };
    }
    return ok({ config, enabledModules: enabled, customRoles: res.customRoles });
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const body = (await req.json().catch(() => ({}))) as {
      role?: string;
      permissions?: string[];
    };
    const role = body.role;
    if (!role) throw new HttpError(400, "role is required");
    if (role === "admin") throw new HttpError(400, "The admin role cannot be restricted");
    const permissions = Array.isArray(body.permissions) ? body.permissions : [];

    try {
      const result = await cx().mutation(api.permissions.setRolePermissions, {
        secret: secret(),
        orgId: session.orgId as never,
        role,
        permissions,
      });
      await recordAudit(session, {
        action: "permissions.update",
        module: "organization",
        summary: `Updated ${role} permissions (${permissions.length} modules granted)`,
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const body = (await req.json().catch(() => ({}))) as {
      action?: "addRole" | "removeRole";
      label?: string;
      key?: string;
    };

    try {
      if (body.action === "addRole") {
        const label = String(body.label ?? "").trim();
        if (!label) throw new HttpError(400, "Role name is required");
        const result = await cx().mutation(api.permissions.addCustomRole, {
          secret: secret(),
          orgId: session.orgId as never,
          label,
        });
        await recordAudit(session, {
          action: "permissions.role_add",
          module: "organization",
          summary: `Added role "${label}"`,
        });
        return ok(result);
      }
      if (body.action === "removeRole") {
        const key = String(body.key ?? "").trim();
        if (!key) throw new HttpError(400, "Role key is required");
        const result = await cx().mutation(api.permissions.removeCustomRole, {
          secret: secret(),
          orgId: session.orgId as never,
          key,
        });
        await recordAudit(session, {
          action: "permissions.role_remove",
          module: "organization",
          summary: `Removed role "${key}"`,
        });
        return ok(result);
      }
      throw new HttpError(400, "Unknown action");
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
