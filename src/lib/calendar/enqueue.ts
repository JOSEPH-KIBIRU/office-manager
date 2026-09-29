import "server-only";
import { after } from "next/server";
import { enqueueForUser, processCalendarJobs } from "./sync";

/**
 * Queue calendar sync for the given users and (best-effort) kick off processing
 * after the current response is sent. Never throws — calendar sync must not
 * break the primary action (approving leave, scheduling a meeting, etc.).
 */
export async function queueCalendarSync(
  orgId: string,
  userIds: Array<string | null | undefined>,
  sourceType: string,
  sourceId: string,
  action: "upsert" | "delete"
): Promise<void> {
  const unique = [...new Set(userIds.filter((u): u is string => Boolean(u)))];
  if (unique.length === 0) return;
  try {
    for (const uid of unique) {
      await enqueueForUser(orgId, uid, sourceType, sourceId, action);
    }
  } catch {
    return;
  }
  try {
    after(async () => {
      await processCalendarJobs(10).catch(() => {});
    });
  } catch {
    /* not in a request scope (e.g. cron) — the scheduled runner will pick it up */
  }
}
