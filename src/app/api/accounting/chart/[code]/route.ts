import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/**
 * PATCH /api/accounting/chart/[code]
 * Edit an account (rename, edit code where safe, reclassify, control/tax flags),
 * or activate/deactivate it via `{ active }`.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const session = await requirePermission("chart-of-accounts", ["admin"]);
    const { code } = await ctx.params;
    const body = await readJson<{
      newCode?: string;
      name?: string;
      type?: string;
      group?: string;
      parentCode?: string;
      category?: string;
      control?: string;
      taxTreatment?: string;
      description?: string;
      isCash?: boolean;
      isVat?: boolean;
      statutory?: boolean;
      active?: boolean;
    }>(req);
    try {
      if (body.active !== undefined) {
        await cx().mutation(api.accounting.setAccountActive, {
          secret: secret(),
          orgId: session.orgId as never,
          code,
          active: body.active,
        });
        await recordAudit(session, {
          action: "accounting.account_archive",
          module: "accounting",
          summary: `${body.active ? "Reactivated" : "Deactivated"} account ${code}`,
        });
        return ok({ code, active: body.active });
      }
      const res = await cx().mutation(api.accounting.updateAccount, {
        secret: secret(),
        orgId: session.orgId as never,
        code,
        newCode: body.newCode,
        name: body.name,
        type: body.type,
        group: body.group,
        parentCode: body.parentCode,
        category: body.category,
        control: body.control,
        taxTreatment: body.taxTreatment,
        description: body.description,
        isCash: body.isCash,
        isVat: body.isVat,
        statutory: body.statutory,
      });
      await recordAudit(session, {
        action: "accounting.account_update",
        module: "accounting",
        summary: `Updated account ${code}`,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
