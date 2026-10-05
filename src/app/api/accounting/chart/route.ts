import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** GET /api/accounting/chart — the company chart of accounts (with balances). */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("chart-of-accounts", ["admin", "secretary", "manager"]);
    const accounts = await cx().query(api.accounting.listChart, {
      secret: secret(),
      orgId: session.orgId as never,
    });
    return ok({ accounts });
  });
}

/** POST /api/accounting/chart — create a ledger account. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("chart-of-accounts", ["admin"]);
    const body = await readJson<{
      code: string;
      name: string;
      type: string;
      group?: string;
      parentCode?: string;
      category?: string;
      control?: string;
      taxTreatment?: string;
      description?: string;
      isCash?: boolean;
      isVat?: boolean;
      statutory?: boolean;
    }>(req);
    requireFields(body, ["code", "name", "type"]);
    try {
      const res = await cx().mutation(api.accounting.createAccount, {
        secret: secret(),
        orgId: session.orgId as never,
        code: String(body.code),
        name: String(body.name),
        type: String(body.type),
        group: body.group ? String(body.group) : "Other",
        parentCode: body.parentCode ?? undefined,
        category: body.category ?? undefined,
        control: body.control ?? undefined,
        taxTreatment: body.taxTreatment ?? undefined,
        description: body.description ?? undefined,
        isCash: body.isCash,
        isVat: body.isVat,
        statutory: body.statutory,
      });
      await recordAudit(session, {
        action: "accounting.account_create",
        module: "accounting",
        summary: `Created account ${body.code} ${body.name}`,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
