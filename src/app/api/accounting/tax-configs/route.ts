import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/** GET / POST / PATCH /api/accounting/tax-configs */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const configs = await cx().query(api.tax.listTaxConfigs, { secret: secret(), orgId: session.orgId as never });
    return ok({ configs });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary"]);
    const body = await readJson<{ action?: "seed" } & Record<string, unknown>>(req);
    try {
      if (body.action === "seed") {
        const res = await cx().mutation(api.tax.seedDefaultTaxes, {
          secret: secret(),
          orgId: session.orgId as never,
          createdBy: session.id as never,
        });
        return ok(res);
      }
      requireFields(body as Record<string, unknown>, ["code", "name", "effectiveDate"]);
      const res = await cx().mutation(api.tax.upsertTaxConfig, {
        secret: secret(),
        orgId: session.orgId as never,
        code: String(body.code),
        name: String(body.name),
        rate: Number(body.rate ?? 0),
        effectiveDate: String(body.effectiveDate),
        inputAccountCode: body.inputAccountCode as string | undefined,
        outputAccountCode: body.outputAccountCode as string | undefined,
        liabilityAccountCode: body.liabilityAccountCode as string | undefined,
        active: body.active as boolean | undefined,
        notes: body.notes as string | undefined,
        createdBy: session.id as never,
      });
      await recordAudit(session, { action: "tax.config", module: "tax", summary: `Saved tax config ${body.code}` });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary"]);
    const body = await readJson<{ code?: string; active?: boolean }>(req);
    if (!body.code) throw new Error("code is required");
    try {
      await cx().mutation(api.tax.setTaxConfigActive, {
        secret: secret(),
        orgId: session.orgId as never,
        code: body.code,
        active: !!body.active,
      });
      return ok({ ok: true });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
