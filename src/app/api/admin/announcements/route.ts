import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

const TYPES = ["info", "maintenance", "training", "offer", "outage"];

export async function GET() {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    let announcements;
    try {
      announcements = await cx().query(api.superadmin.listAnnouncements, {
        secret: secret(),
        superAdminId: session.id as never,
      });
    } catch (e) {
      return mapConvexError(e);
    }
    return ok({ announcements });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const body = await readJson<{
      message: string;
      type: string;
      link?: string;
      active?: boolean;
      color?: string;
    }>(req);
    requireFields(body, ["message", "type"]);

    const message = String(body.message).trim();
    if (!message) throw new HttpError(400, "Message is required");
    if (!TYPES.includes(body.type)) throw new HttpError(400, "Invalid type");
    const color = normalizeColor(body.color);

    try {
      const result = await cx().mutation(api.superadmin.createAnnouncement, {
        secret: secret(),
        superAdminId: session.id as never,
        message,
        type: body.type,
        link: body.link ? String(body.link).trim() : undefined,
        active: body.active !== false,
        color: color ?? undefined,
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
