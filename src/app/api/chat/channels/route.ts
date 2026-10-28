import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

const ROLES = ["admin", "secretary", "manager", "employee"];

export async function GET() {
  return handle(async () => {
    const session = await requirePermission("chat", ROLES);
    try {
      await cx().mutation(api.chat.ensureDefaultChannel, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
      });
      const channels = await cx().query(api.chat.listChannels, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
      });
      return ok({ channels });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("chat", ROLES);
    const body = await readJson<{ name?: string; description?: string }>(req);
    try {
      const id = await cx().mutation(api.chat.createChannel, {
        secret: secret(),
        orgId: session.orgId as never,
        actorId: session.id as never,
        name: String(body.name ?? ""),
        description: body.description,
      });
      await recordAudit(session, {
        action: "chat.channel.create",
        module: "chat",
        summary: `Created chat channel "${body.name ?? ""}"`,
        targetType: "chatChannel",
        targetId: String(id),
      });
      return ok({ id });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
