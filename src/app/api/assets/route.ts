import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** List the asset register. Admin / secretary / manager. */
export async function GET() {
  return handle(async () => {
    const session = await requirePermission("assets", ["admin", "secretary"]);
    try {
      const assets = await cx().query(api.assets.listAssets, {
        secret: secret(),
        orgId: session.orgId as never,
      });
      return ok({ assets });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Register a new asset. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("assets", ["admin", "secretary"]);
    const body = await readJson<{
      tag: string;
      name: string;
      category?: string;
      serialNumber?: string;
      condition?: string;
    }>(req);
    requireFields(body, ["tag", "name"]);
    if (String(body.name).trim().length < 2) throw new HttpError(400, "Enter the asset name");
    if (!String(body.tag).trim()) throw new HttpError(400, "Enter the asset tag/number");

    try {
      const id = await cx().mutation(api.assets.createAsset, {
        secret: secret(),
        orgId: session.orgId as never,
        tag: String(body.tag),
        name: String(body.name),
        category: body.category,
        serialNumber: body.serialNumber,
        condition: body.condition,
      });
      return ok({ id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
