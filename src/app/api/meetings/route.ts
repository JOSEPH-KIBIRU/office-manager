import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields, maxLen } from "@/lib/api";
import { notifyMeetingScheduled } from "@/lib/notify";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { queueCalendarSync } from "@/lib/calendar/enqueue";

export async function GET() {
  return handle(async () => {
    const session = await requirePermission("meetings", ["admin", "secretary", "manager", "employee"]);
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
    const session = await requirePermission("meetings", ["admin", "secretary"]);
    const body = await readJson<{
      title: string;
      agenda?: string;
      location?: string;
      scheduled_at: string;
      attendees?: (string | number)[];
      director_id?: string | number | null;
    }>(req);
    requireFields(body, ["title", "scheduled_at"]);
    maxLen(body.title, "Title", 200);
    if (body.agenda !== undefined) maxLen(body.agenda, "Agenda", 2000);
    if (body.location !== undefined) maxLen(body.location, "Location", 200);

    const attendeeIds = Array.isArray(body.attendees)
      ? body.attendees.map(String).filter((s) => s.length > 0).slice(0, 100)
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

    await queueCalendarSync(
      session.orgId as string,
      [session.id, ...attendeeIds, body.director_id ? String(body.director_id) : null],
      "meeting",
      id,
      "upsert"
    );

    return ok({ meetingId: id });
  });
}
