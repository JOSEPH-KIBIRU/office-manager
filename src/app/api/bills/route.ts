import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("bills", ["admin", "manager", "secretary"]);
    const rows = await cx().query(api.bills.listBills, {
      secret: secret(),
      orgId: session.orgId as never,
    });
    return ok({ bills: rows });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("bills", ["admin", "manager", "secretary"]);
    const body = await readJson<{
      contactId: string;
      billDate: string;
      dueDate: string;
      amount: number;
      vatRate?: number;
      description?: string;
      costCenterCode?: string;
      projectId?: string;
    }>(req);
    if (!body.contactId || !body.billDate || !body.dueDate) {
      throw new Error("Supplier, bill date and due date are required");
    }
    if (!(Number(body.amount) > 0)) throw new Error("Amount must be greater than zero");
    try {
      const id = await cx().mutation(api.bills.createBill, {
        secret: secret(),
        orgId: session.orgId as never,
        contactId: body.contactId as never,
        billDate: body.billDate,
        dueDate: body.dueDate,
        amount: Number(body.amount),
        vatRate: body.vatRate !== undefined ? Number(body.vatRate) : undefined,
        description: body.description ?? undefined,
        costCenterCode: body.costCenterCode || undefined,
        projectId: body.projectId as never,
        createdBy: session.id as never,
      });
      return ok({ id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
