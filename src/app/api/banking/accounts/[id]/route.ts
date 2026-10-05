import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** PATCH /api/banking/accounts/[id] — edit a bank/M-Pesa account. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("chart-of-accounts", ["admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      name?: string;
      bankName?: string;
      accountNumber?: string;
      currency?: string;
      paybill?: string;
      till?: string;
      businessNumber?: string;
      active?: boolean;
    }>(req);
    try {
      await cx().mutation(api.banking.updateBankAccount, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        name: body.name,
        bankName: body.bankName,
        accountNumber: body.accountNumber,
        currency: body.currency,
        paybill: body.paybill,
        till: body.till,
        businessNumber: body.businessNumber,
        active: body.active,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
