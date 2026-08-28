import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson } from "@/lib/api";
import { notifyMeetingScheduled } from "@/lib/notify";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["admin", "secretary"]);
    const { id } = await ctx.params;

    const row = await cx().query(api.meetings.getMeeting, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
    });
    if (!row) throw new HttpError(404, "Meeting not found");

    const body = await readJson<{
      title?: string;
      agenda?: string;
      location?: string;
      scheduled_at?: string;
      attendees?: (string | number)[];
      director_id?: string | number | null;
      status?: string;
    }>(req);

    if (body.status && !["scheduled", "completed", "cancelled"].includes(body.status)) {
      throw new HttpError(400, "Invalid status");
    }

    const prevAttendees: string[] = JSON.parse(String(row.attendees || "[]"));
    const attendees = Array.isArray(body.attendees)
      ? body.attendees.map(String).filter((s) => s.length > 0)
      : prevAttendees;

    let result;
    try {
      result = await cx().mutation(api.meetings.updateMeeting, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        title: body.title?.trim(),
        agenda: body.agenda?.trim(),
        location: body.location?.trim(),
        scheduledAt: body.scheduled_at,
        attendeeIds: Array.isArray(body.attendees) ? (attendees as never[]) : undefined,
        directorIdSet: body.director_id !== undefined,
        directorId: (body.director_id ? String(body.director_id) : null) as never,
        status: body.status as never,
      });
    } catch (e) {
      return mapConvexError(e);
    }

    // Notify newly added attendees and everyone if rescheduled
    const newIds = attendees.filter((a) => !prevAttendees.includes(a));
    const toNotify = [...new Set([...newIds, ...(result.rescheduled ? attendees : [])])];
    if (toNotify.length > 0) {
      await notifyMeetingScheduled(
        session.orgId,
        toNotify.map(String),
        result.finalTitle,
        result.finalScheduledAt,
        result.finalLocation ?? null
      );
    }

    return ok({ meetingId: id });
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser(["admin", "secretary"]);
    const { id } = await ctx.params;
    try {
      await cx().mutation(api.meetings.deleteMeeting, {
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
