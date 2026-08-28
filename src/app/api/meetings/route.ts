import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { notifyMeetingScheduled } from "@/lib/notify";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET() {
  return handle(async () => {
    const session = await requireUser();
    try {
      const meetings = await cx().query(api.meetings.listMeetings, {
        secret: secret(),
        orgId: session.orgId as never,
      });
      return ok({ meetings });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser(["admin", "secretary"]);
    const body = await readJson<{
      title: string;
      agenda?: string;
      location?: string;
      scheduled_at: string;
      attendees?: (string | number)[];
      director_id?: string | number | null;
    }>(req);
    requireFields(body, ["title", "scheduled_at"]);

    const attendeeIds = Array.isArray(body.attendees)
      ? body.attendees.map(String).filter((s) => s.length > 0)
      : [];

    // Attendees must belong to the same organization.
    for (const aId of [...attendeeIds, ...(body.director_id ? [String(body.director_id)] : [])]) {
      const u = await cx().query(api.auth.getUserById, {
        secret: secret(),
        id: aId as never,
        orgId: session.orgId as never,
      });
      if (!u) throw new HttpError(400, "One or more attendees do not belong to your organization");
    }

    let id: string;
    try {
      id = await cx().mutation(api.meetings.createMeeting, {
        secret: secret(),
        orgId: session.orgId as never,
        createdBy: session.id as never,
        title: String(body.title).trim(),
        agenda: body.agenda?.trim() || undefined,
        location: body.location?.trim() || undefined,
        scheduledAt: body.scheduled_at,
        attendeeIds: attendeeIds as never[],
        directorId: (body.director_id ? String(body.director_id) : undefined) as never,
      });
    } catch (e) {
      return mapConvexError(e);
    }

    if (attendeeIds.length > 0) {
      await notifyMeetingScheduled(
        session.orgId,
        attendeeIds.map(String),
        String(body.title),
        String(body.scheduled_at),
        body.location ?? null
      );
    }

    return ok({ meetingId: id });
  });
}
