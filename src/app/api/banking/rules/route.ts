import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** GET /api/banking/rules */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const rules = await cx().query(api.banking.listBankRules, { secret: secret(), orgId: session.orgId as never });
    return ok({ rules });
  });
}

/** POST /api/banking/rules — create a transaction rule (suggestion unless autoPost). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting-post", ["admin", "secretary"]);
    const body = await readJson<{
      name: string;
      matchField: "description" | "reference";
      matchType: "contains" | "equals" | "starts_with";
      matchValue: string;
      suggestAccountCode: string;
      suggestType?: string;
      autoPost?: boolean;
    }>(req);
    requireFields(body, ["name", "matchValue", "suggestAccountCode"]);
    try {
      const res = await cx().mutation(api.banking.createBankRule, {
        secret: secret(),
        orgId: session.orgId as never,
        name: String(body.name),
        matchField: body.matchField ?? "description",
        matchType: body.matchType ?? "contains",
        matchValue: String(body.matchValue),
        suggestAccountCode: body.suggestAccountCode,
        suggestType: body.suggestType,
        autoPost: body.autoPost ?? false,
      });
      await recordAudit(session, { action: "banking.rule_create", module: "banking", summary: `Created bank rule ${body.name}` });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
