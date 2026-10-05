import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api } from "@/lib/convex";

/** GET /api/banking/transactions/[id]/suggest — rule + candidate suggestions. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("accounting", ["admin", "secretary", "manager"]);
    const { id } = await ctx.params;
    const res = await cx().query(api.banking.suggestForLine, {
      secret: secret(),
      orgId: session.orgId as never,
      lineId: id as never,
    });
    return ok(res);
  });
}
