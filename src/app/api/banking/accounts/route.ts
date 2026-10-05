import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** GET /api/banking/accounts — bank & M-Pesa accounts with live balances. */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const accounts = await cx().query(api.banking.listBankAccounts, { secret: secret(), orgId: session.orgId as never });
    return ok({ accounts });
  });
}

/** POST /api/banking/accounts — create a bank or M-Pesa account. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("chart-of-accounts", ["admin"]);
    const body = await readJson<{
      kind: "bank" | "mpesa";
      name: string;
      bankName?: string;
      accountNumber?: string;
      currency?: string;
      openingBalance?: number;
      accountCode?: string;
      paybill?: string;
      till?: string;
      businessNumber?: string;
    }>(req);
    requireFields(body, ["kind", "name"]);
    try {
      const res = await cx().mutation(api.banking.createBankAccount, {
        secret: secret(),
        orgId: session.orgId as never,
        kind: body.kind,
        name: String(body.name),
        bankName: body.bankName,
        accountNumber: body.accountNumber,
        currency: body.currency,
        openingBalance: body.openingBalance !== undefined ? Number(body.openingBalance) : undefined,
        accountCode: body.accountCode,
        paybill: body.paybill,
        till: body.till,
        businessNumber: body.businessNumber,
        createdBy: session.id as never,
      });
      await recordAudit(session, { action: "banking.account_create", module: "banking", summary: `Created ${body.kind} account ${body.name}` });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
