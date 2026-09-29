import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("invoices", ["admin", "manager", "secretary"]);
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const rows = await cx().query(api.invoicing.listContacts, {
      secret: secret(),
      orgId: session.orgId as never,
      type: type && (type === "customer" || type === "supplier") ? (type as never) : undefined,
    });
    return ok({ contacts: rows });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("invoices", ["admin", "manager", "secretary"]);
    const body = await readJson<{
      type: "customer" | "supplier";
      name: string;
      email?: string;
      phone?: string;
      company?: string;
      address?: string;
      tin?: string;
    }>(req);
    if (!body.type || !["customer", "supplier"].includes(body.type)) {
      throw new Error("Contact type must be customer or supplier");
    }
    if (!body.name) throw new Error("Contact name is required");
    try {
      const id = await cx().mutation(api.invoicing.createContact, {
        secret: secret(),
        orgId: session.orgId as never,
        type: body.type as never,
        name: body.name,
        email: body.email ?? undefined,
        phone: body.phone ?? undefined,
        company: body.company ?? undefined,
        address: body.address ?? undefined,
        tin: body.tin ?? undefined,
      });
      return ok({ id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
