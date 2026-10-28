import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

const ROLES = ["admin", "secretary", "manager", "employee"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET messages.
 * - Without `after`: returns the latest messages immediately.
 * - With `after` (a createdAt timestamp): long-polls for up to ~7s and returns
 *   only messages newer than `after`, as soon as they exist. Pass `wait=0` to
 *   skip waiting.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("chat", ROLES);
    const { id } = await ctx.params;
    const p = new URL(req.url).searchParams;
    const limitRaw = p.get("limit");
    const afterRaw = p.get("after");
    const wait = p.get("wait") !== "0";
    const after = afterRaw !== null && afterRaw !== "" ? Number(afterRaw) : null;

    const fetchBatch = (afterVal?: number) =>
      cx().query(api.chat.listMessages, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        channelId: id as never,
        limit: limitRaw ? Number(limitRaw) : undefined,
        after: afterVal,
      });

    try {
      if (after === null || Number.isNaN(after)) {
        const messages = await fetchBatch();
        return ok({ messages, serverTime: Date.now() });
      }

      const deadline = Date.now() + 7000;
      do {
        const messages = await fetchBatch(after);
        if (messages.length > 0) return ok({ messages, serverTime: Date.now() });
        if (!wait) break;
        await sleep(750);
      } while (Date.now() < deadline);

      return ok({ messages: [], serverTime: Date.now() });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("chat", ROLES);
    const { id } = await ctx.params;
    const body = await readJson<{ body?: string; mentionIds?: string[] }>(req);
    try {
      const res = await cx().mutation(api.chat.sendMessage, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        channelId: id as never,
        body: String(body.body ?? ""),
        mentionIds: (Array.isArray(body.mentionIds) ? body.mentionIds : undefined) as never,
      });
      return ok(res);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
