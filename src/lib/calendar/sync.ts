import "server-only";
import { cx, secret, api } from "@/lib/convex";
import { decryptToken, encryptToken } from "./crypto";
import { getProvider, type CalendarEventInput } from "./providers";

const GOOGLE_TZ = "Africa/Nairobi";
const MS_TZ = "E. Africa Standard Time";

function tz(providerId: string) {
  return providerId === "microsoft" ? MS_TZ : GOOGLE_TZ;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMinutes(local: string, minutes: number): string {
  const d = new Date(`${local}Z`); // treat as UTC to do pure arithmetic on wall-clock
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString().slice(0, 19);
}

function toLocalDateTime(s: string): string {
  return `${s.replace(" ", "T")}:00`.slice(0, 19);
}

interface ConnLike {
  _id: string;
  provider: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

async function freshAccessToken(conn: ConnLike): Promise<string> {
  const provider = getProvider(conn.provider);
  if (!provider) throw new Error(`Unknown calendar provider: ${conn.provider}`);
  const access = decryptToken(conn.accessToken);
  if (conn.expiresAt - Date.now() > 60_000) return access;
  if (!conn.refreshToken) return access;
  const refreshed = await provider.refresh(decryptToken(conn.refreshToken));
  await cx().mutation(api.calendar.updateConnectionTokens, {
    secret: secret(),
    id: conn._id as never,
    accessToken: encryptToken(refreshed.accessToken),
    expiresAt: refreshed.expiresAt,
    refreshToken: refreshed.refreshToken ? encryptToken(refreshed.refreshToken) : undefined,
  });
  return refreshed.accessToken;
}

/** Build the calendar event for a source record. Returns null when the event
 *  should not exist (e.g. leave not approved, meeting cancelled) → delete it. */
async function buildEvent(
  sourceType: string,
  sourceId: string,
  orgId: string,
  providerId: string
): Promise<CalendarEventInput | null> {
  if (sourceType === "leave") {
    const leave = await cx().query(api.leaves.getLeave, {
      secret: secret(),
      orgId: orgId as never,
      id: sourceId as never,
    });
    if (!leave || leave.status !== "approved") return null;
    const name = (leave.requester_name as string) || "Employee";
    return {
      title: `${name} — ${leave.leave_type} leave`,
      description: leave.reason ? `Reason: ${leave.reason}` : "Approved leave",
      location: null,
      allDay: true,
      start: leave.start_date as string,
      end: addDays(leave.end_date as string, 1),
      timeZone: tz(providerId),
    };
  }

  if (sourceType === "meeting") {
    const meeting = await cx().query(api.meetings.getMeeting, {
      secret: secret(),
      orgId: orgId as never,
      id: sourceId as never,
    });
    if (!meeting || meeting.status === "cancelled") return null;
    const start = toLocalDateTime(meeting.scheduled_at as string);
    return {
      title: meeting.title as string,
      description: meeting.agenda as string | null,
      location: (meeting.location as string | null) ?? null,
      allDay: false,
      start,
      end: addMinutes(start, 60),
      timeZone: tz(providerId),
    };
  }

  return null;
}

async function removeMappedEvent(
  provider: ReturnType<typeof getProvider>,
  accessToken: string,
  sourceType: string,
  sourceId: string,
  userId: string,
  providerId: string
) {
  if (!provider) return;
  const maps = await cx().query(api.calendar.getEventMap, {
    secret: secret(),
    sourceType,
    sourceId,
    userId: userId as never,
  });
  for (const m of maps) {
    if (m.provider !== providerId) continue;
    await provider.deleteEvent(accessToken, m.externalEventId);
    await cx().mutation(api.calendar.deleteEventMap, { secret: secret(), id: m._id as never });
  }
}

export interface SyncSummary {
  claimed: number;
  ok: number;
  failed: number;
  skipped: number;
}

/** Claim and process pending calendar sync jobs. Safe to call from request
 *  handlers (best-effort) and from the scheduled runner. */
export async function processCalendarJobs(limit = 10): Promise<SyncSummary> {
  const jobs = await cx().mutation(api.calendar.claimJobs, { secret: secret(), limit });
  const summary: SyncSummary = { claimed: jobs.length, ok: 0, failed: 0, skipped: 0 };

  for (const job of jobs) {
    const finish = (ok: boolean, error?: string) =>
      cx().mutation(api.calendar.finishJob, { secret: secret(), id: job._id as never, ok, error });

    try {
      const conn = await cx().query(api.calendar.getConnection, {
        secret: secret(),
        orgId: job.orgId as never,
        userId: job.userId as never,
        provider: job.provider as never,
      });
      if (!conn) {
        await finish(true);
        summary.skipped++;
        continue;
      }
      const provider = getProvider(job.provider);
      if (!provider) throw new Error(`Unknown provider ${job.provider}`);
      const accessToken = await freshAccessToken(conn as unknown as ConnLike);

      if (job.action === "delete") {
        await removeMappedEvent(provider, accessToken, job.sourceType, job.sourceId, job.userId, job.provider);
      } else {
        const event = await buildEvent(job.sourceType, job.sourceId, job.orgId, job.provider);
        if (!event) {
          await removeMappedEvent(provider, accessToken, job.sourceType, job.sourceId, job.userId, job.provider);
        } else {
          const maps = await cx().query(api.calendar.getEventMap, {
            secret: secret(),
            sourceType: job.sourceType,
            sourceId: job.sourceId,
            userId: job.userId as never,
          });
          const mine = maps.find((m) => m.provider === job.provider);
          const externalEventId = await provider.upsertEvent(accessToken, mine?.externalEventId ?? null, event);
          await cx().mutation(api.calendar.upsertEventMap, {
            secret: secret(),
            orgId: job.orgId as never,
            userId: job.userId as never,
            provider: job.provider,
            sourceType: job.sourceType,
            sourceId: job.sourceId,
            externalEventId,
            calendarId: "primary",
          });
        }
      }
      await finish(true);
      summary.ok++;
    } catch (e) {
      await finish(false, e instanceof Error ? e.message : "Sync failed");
      summary.failed++;
    }
  }

  return summary;
}

/** Queue a sync for one user across all their connected calendars. */
export async function enqueueForUser(
  orgId: string,
  userId: string,
  sourceType: string,
  sourceId: string,
  action: "upsert" | "delete"
): Promise<number> {
  return cx().mutation(api.calendar.enqueueForUser, {
    secret: secret(),
    orgId: orgId as never,
    userId: userId as never,
    sourceType,
    sourceId,
    action,
  });
}
