import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields, validDate } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** Reverse a posted journal with a reversing entry. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting-reverse", ["admin", "secretary"]);
    const body = await readJson<{ journalId: string; date?: string }>(req);
    requireFields(body, ["journalId"]);
    const date = body.date ? validDate(body.date, "Date") : new Date().toISOString().slice(0, 10);
    try {
      const id = await cx().mutation(api.accounting.reverseJournal, {
        secret: secret(),
        orgId: session.orgId as never,
        journalId: String(body.journalId) as never,
        date,
        postedBy: session.id as never,
        postedByName: session.name,
      });
      await recordAudit(session, {
        action: "accounting.reverse",
        module: "accounting",
        summary: `Reversed journal ${String(body.journalId)}`,
        targetType: "journal",
        targetId: String(body.journalId),
      });
      return ok({ journalId: id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
