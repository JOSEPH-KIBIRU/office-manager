import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { generateMinutes } from "@/lib/ai";

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin", "secretary"]);
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
