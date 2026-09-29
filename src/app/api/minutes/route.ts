import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET() {
  return handle(async () => {
    const session = await requirePermission("minutes", ["admin", "secretary", "manager", "employee"]);
    try {
      const minutes = await cx().query(api.minutes.listMinutes, {
        secret: secret(),
        orgId: session.orgId as never,
      });
      return ok({ minutes });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("minutes", ["admin", "secretary"]);
    const body = await readJson<{
      title: string;
      meeting_date?: string;
      attendees?: string;
      points?: string;
      content?: string;
      meeting_id?: string | null;
      file_name?: string | null;
      file_path?: string | null;
    }>(req);
    requireFields(body, ["title"]);

    let id: string;
    try {
      id = await cx().mutation(api.minutes.createMinute, {
        secret: secret(),
        orgId: session.orgId as never,
        writtenBy: session.id as never,
        title: String(body.title).trim(),
        meetingDate: body.meeting_date || undefined,
        attendeesText: body.attendees?.trim() || undefined,
        points: body.points?.trim() || "",
        content: body.content?.trim() || "",
        meetingId: (body.meeting_id ? String(body.meeting_id) : undefined) as never,
        fileName: body.file_name || undefined,
        fileId: (body.file_path || undefined) as never,
        aiGenerated: false,
      });
    } catch (e) {
      return mapConvexError(e);
    }

    const row = await cx().query(api.minutes.getMinute, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
    });
    return ok({ minute: row });
  });
}
