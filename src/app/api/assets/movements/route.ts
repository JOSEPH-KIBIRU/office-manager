import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Asset movement trail with optional date/asset/person filters. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("assets", ["admin", "secretary"]);
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const assetId = url.searchParams.get("assetId");
    const holderId = url.searchParams.get("holderId");

    try {
      const movements = await cx().query(api.assets.listAssetMovements, {
        secret: secret(),
        orgId: session.orgId as never,
        from: from ? Number(from) : undefined,
        to: to ? Number(to) : undefined,
        assetId: (assetId || undefined) as never,
        holderId: (holderId || undefined) as never,
      });
      return ok({ movements });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

/** Record a movement: allocate (check out) or return (check in). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("assets", ["admin", "secretary"]);
    const body = await readJson<{
      kind: "allocate" | "return";
      assetId: string;
      holderId?: string;
      at?: number;
      destination?: string;
      condition?: string;
      note?: string;
    }>(req);
    requireFields(body, ["kind", "assetId"]);

    try {
      if (body.kind === "allocate") {
        if (!body.holderId) throw new HttpError(400, "Choose who the asset is being given to");
        const res = await cx().mutation(api.assets.allocateAsset, {
          secret: secret(),
          orgId: session.orgId as never,
          assetId: body.assetId as never,
          holderId: body.holderId as never,
          recordedBy: session.id as never,
          recordedByName: session.name,
          at: body.at,
          destination: body.destination,
          condition: body.condition,
          note: body.note,
        });
        return ok(res);
      }
      const res = await cx().mutation(api.assets.returnAsset, {
        secret: secret(),
        orgId: session.orgId as never,
        assetId: body.assetId as never,
        recordedBy: session.id as never,
        recordedByName: session.name,
        at: body.at,
        condition: body.condition,
        note: body.note,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
