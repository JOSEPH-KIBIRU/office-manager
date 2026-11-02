import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { generateMinutes } from "@/lib/ai";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("minutes", ["admin", "secretary"]);
    // Per organisation + user (not IP) so colleagues sharing an office IP are
    // not throttled by each other.
    if (
      !rateLimit({
        key: `minutes-generate:org:${session.orgId}:user:${session.id}`,
        limit: 12,
        windowMs: 5 * 60_000,
      })
    ) {
      throw new HttpError(429, "Too many AI generations. Please wait a few minutes and try again.");
    }
    const body = await readJson<{ title: string; meeting_date?: string; attendees?: string; points: string }>(req);
    requireFields(body, ["title", "points"]);

    const content = await generateMinutes({
      title: String(body.title).trim(),
      meetingDate: body.meeting_date || null,
      attendees: body.attendees || null,
      points: String(body.points),
    });

    return ok({ content });
  });
}
