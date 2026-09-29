import { NextRequest } from "next/server";
import { HttpError, requireUser, startImpersonation, stopImpersonation } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const body = await readJson<{ orgId: string }>(req);
    if (!body.orgId) throw new HttpError(400, "orgId is required");

    let orgs;
    try {
      orgs = await cx().query(api.superadmin.listAllOrganizations, {
        secret: secret(),
        superAdminId: session.id as never,
      });
    } catch (e) {
      return mapConvexError(e);
    }

    const target = (orgs as { id: string; name: string; slug: string; active: boolean }[]).find(
      (o) => o.id === body.orgId
    );
    if (!target) throw new HttpError(404, "Company not found");
    if (target.slug === "__platform") throw new HttpError(400, "Cannot impersonate the platform org");

    // Impersonate as an active admin OF the target company so personal-scoped
    // queries (dashboard, analytics, notifications, payslips) resolve to a real
    // member of that org rather than the platform super-admin account.
    let admins;
    try {
      admins = await cx().query(api.auth.getActiveAdmins, {
        secret: secret(),
        orgId: body.orgId as never,
      });
    } catch (e) {
      return mapConvexError(e);
    }
    const adminUser = admins[0];
    if (!adminUser) throw new HttpError(400, "Company has no active administrator");

    await startImpersonation(session, body.orgId, target.name, {
      id: adminUser._id as string,
      name: adminUser.name,
      email: adminUser.email,
    });
    return ok({ orgId: body.orgId, name: target.name, adminName: adminUser.name });
  });
}

export async function DELETE() {
  return handle(async () => {
    const session = await requireUser();
    const restored = await stopImpersonation(session);
    if (!restored) throw new HttpError(400, "Not currently impersonating");
    return ok({ restored: true });
  });
}
