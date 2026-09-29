import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { ORG_ROLES, DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";

const ROLE_SET = new Set<string>(ORG_ROLES);

/**
 * Fine-grained role permissions.
 * GET   /api/permissions - admin reads the full per-role matrix.
 * PATCH /api/permissions - admin sets the granted modules for one role.
 */
export async function GET() {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const res = (await cx().query(api.permissions.getPermissionsConfig, {
      secret: secret(),
      orgId: session.orgId as never,
    })) as {
      config: Record<string, { granted: string[] | null; overridden: boolean }>;
      enabledModules: string[] | null;
    };

    const enabled = res.enabledModules;
    const config: Record<string, { granted: string[]; overridden: boolean }> = {};
    for (const role of ORG_ROLES) {
      const c = res.config[role];
      const base = c.granted ?? DEFAULT_ROLE_PERMISSIONS[role as keyof typeof DEFAULT_ROLE_PERMISSIONS];
      // Never expose a grant for a module the platform has disabled.
      config[role] = {
        granted: enabled ? base.filter((m) => enabled.includes(m)) : base,
        overridden: c.overridden,
      };
    }
    return ok({ config, enabledModules: enabled });
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
    if (!role || !ROLE_SET.has(role)) return ok({ error: "Invalid role" });
    if (role === "admin") return ok({ error: "The admin role cannot be restricted" });
    const permissions = Array.isArray(body.permissions) ? body.permissions : [];

    try {
      const result = await cx().mutation(api.permissions.setRolePermissions, {
        secret: secret(),
        orgId: session.orgId as never,
        role: role as "secretary" | "manager" | "employee",
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
