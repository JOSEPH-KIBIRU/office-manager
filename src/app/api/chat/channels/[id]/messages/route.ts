import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

const ROLES = ["admin", "secretary", "manager", "employee"];

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("chat", ROLES);
    const { id } = await ctx.params;
    const limit = new URL(req.url).searchParams.get("limit");
    try {
      const messages = await cx().query(api.chat.listMessages, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        channelId: id as never,
        limit: limit ? Number(limit) : undefined,
      });
      return ok({ messages });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("chat", ROLES);
    const { id } = await ctx.params;
    const body = await readJson<{ body?: string }>(req);
    try {
      const res = await cx().mutation(api.chat.sendMessage, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        channelId: id as never,
        body: String(body.body ?? ""),
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
