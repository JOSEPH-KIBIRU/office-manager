import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("minutes", ["admin", "secretary", "manager", "employee"]);
    const { id } = await ctx.params;
    const row = await cx().query(api.minutes.getMinute, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
    });
    if (!row) throw new HttpError(404, "Minutes not found");
    return ok({ minute: row });
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("minutes", ["admin", "secretary"]);
    const { id } = await ctx.params;

    const existing = await cx().query(api.minutes.getMinute, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
    });
    if (!existing) throw new HttpError(404, "Minutes not found");

    const body = await readJson<{
      title?: string;
      meeting_date?: string | null;
      attendees?: string | null;
      points?: string;
      content?: string;
      status?: "draft" | "final";
      meeting_id?: string | number | null;
      file_name?: string | null;
      file_path?: string | null;
      ai_generated?: boolean;
    }>(req);

    if (body.status && !["draft", "final"].includes(body.status)) throw new HttpError(400, "Invalid status");

    try {
      await cx().mutation(api.minutes.updateMinute, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        title: body.title?.trim(),
        meetingDateSet: body.meeting_date !== undefined,
        meetingDate: (body.meeting_date || undefined) as never,
        attendeesSet: body.attendees !== undefined,
        attendeesText: (body.attendees || undefined) as never,
        points: body.points?.trim(),
        content: body.content ?? undefined,
        status: body.status as never,
        meetingIdSet: body.meeting_id !== undefined,
        meetingId: (body.meeting_id ? String(body.meeting_id) : undefined) as never,
        fileName: body.file_name ?? undefined,
        fileId: (body.file_path || undefined) as never,
        aiGenerated: body.ai_generated ? true : undefined,
      });
    } catch (e) {
      return mapConvexError(e);
    }

    const updated = await cx().query(api.minutes.getMinute, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
    });
    return ok({ minute: updated });
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("minutes", ["admin", "secretary"]);
    const { id } = await ctx.params;
    try {
      await cx().mutation(api.minutes.deleteMinute, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
      });
      return ok();
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
