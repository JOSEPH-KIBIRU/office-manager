import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

const TYPES = ["info", "maintenance", "training", "offer", "outage"];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const { id } = await ctx.params;
    const body = await readJson<{
      message?: string;
      type?: string;
      link?: string;
      active?: boolean;
      color?: string;
    }>(req);

    if (body.message !== undefined && !String(body.message).trim()) {
      throw new HttpError(400, "Message cannot be empty");
    }
    if (body.type !== undefined && !TYPES.includes(body.type)) {
      throw new HttpError(400, "Invalid type");
    }
    const color = body.color === undefined ? undefined : normalizeColor(body.color);

    try {
      const result = await cx().mutation(api.superadmin.updateAnnouncement, {
        secret: secret(),
        superAdminId: session.id as never,
        id: id as never,
        message: body.message === undefined ? undefined : String(body.message).trim(),
        type: body.type,
        link: body.link === undefined ? undefined : String(body.link).trim(),
        active: body.active,
        color: color === null ? undefined : color,
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

function normalizeColor(color: unknown): string | null {
  if (typeof color !== "string") return null;
  const c = color.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(c)) return null;
  return c;
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const { id } = await ctx.params;
    try {
      const result = await cx().mutation(api.superadmin.deleteAnnouncement, {
        secret: secret(),
        superAdminId: session.id as never,
        id: id as never,
      });
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
