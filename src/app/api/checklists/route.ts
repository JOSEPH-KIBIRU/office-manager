import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** List onboarding/offboarding checklists (seeding defaults on first view). */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("onboarding", ["admin", "secretary"]);
    try {
      await cx().mutation(api.checklists.ensureForOrg, { secret: secret(), orgId: session.orgId as never });
      const people = await cx().query(api.checklists.list, { secret: secret(), orgId: session.orgId as never });
      return ok({ people });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Add a custom checklist item. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("onboarding", ["admin", "secretary"]);
    const body = await readJson<{ userId: string; kind: "onboarding" | "offboarding"; title: string }>(req);
    requireFields(body, ["userId", "kind", "title"]);
    try {
      const id = await cx().mutation(api.checklists.addItem, {
        secret: secret(),
        orgId: session.orgId as never,
        userId: body.userId as never,
        kind: body.kind,
        title: body.title,
      });
      return ok({ id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
