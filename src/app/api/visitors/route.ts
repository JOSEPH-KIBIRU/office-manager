import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** List visitors. Admins/secretaries see all; other staff see only their own. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("visitors", ["admin", "secretary", "manager", "employee"]);
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    try {
      const visitors = await cx().query(api.visitors.listVisitors, {
        secret: secret(),
        orgId: session.orgId as never,
        viewerId: session.id as never,
        from: from ? Number(from) : undefined,
        to: to ? Number(to) : undefined,
      });
      return ok({ visitors });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Register an arriving visitor. Reception only (admin + secretary). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("visitors", ["admin", "secretary"]);
    const body = await readJson<{
      visitorName: string;
      phone: string;
      carReg: string;
      visitorTo: string;
    }>(req);
    requireFields(body, ["visitorName", "phone", "visitorTo"]);

    const visitorName = String(body.visitorName).trim();
    const phone = String(body.phone).trim().replace(/[^0-9+]/g, "");
    const carReg = String(body.carReg ?? "").trim().toUpperCase();
    const visitorTo = String(body.visitorTo).trim();

    if (visitorName.length < 2) throw new HttpError(400, "Please enter the visitor's full name");
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 9 || phoneDigits.length > 13) {
      throw new HttpError(400, "Please enter a valid phone number");
    }

    try {
      const result = await cx().mutation(api.visitors.addVisitor, {
        secret: secret(),
        orgId: session.orgId as never,
        visitorName,
        phone,
        carReg,
        visitorTo: visitorTo as never,
        createdBy: session.id as never,
      });
      return ok({ id: result.id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
