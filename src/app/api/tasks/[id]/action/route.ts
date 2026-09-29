import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields, maxLen } from "@/lib/api";
import { notifyTaskReportSubmitted } from "@/lib/notify";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/** Task actions: start, cancel, report, comment, acknowledge, reopen. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser();
    const { id } = await ctx.params;
    const body = await readJson<{
      action: string;
      description?: string;
      doing?: string;
      location?: string;
      photos?: Array<{ url?: string; name: string }>;
      text?: string;
      remark?: string;
    }>(req);
    requireFields(body, ["action"]);

    const base = { secret: secret(), orgId: session.orgId as never, userId: session.id as never };

    try {
      switch (body.action) {
        case "start":
          await cx().mutation(api.tasks.startTask, { ...base, id: id as never });
          return ok();
        case "cancel":
          await cx().mutation(api.tasks.cancelTask, { ...base, id: id as never });
          return ok();
        case "report": {
          const photos = (body.photos ?? [])
            .slice(0, 10)
            .map((p) => ({ url: String(p.url ?? ""), name: String(p.name).slice(0, 200) }))
            .filter((p) => p.url);
          if (body.description !== undefined) maxLen(body.description, "Description", 4000);
          if (body.doing !== undefined) maxLen(body.doing, "What you were doing", 1000);
          if (body.location !== undefined) maxLen(body.location, "Location", 300);
          if (!(body.description ?? "").trim() && photos.length === 0) {
            throw new HttpError(400, "Add a short description or at least one photo before submitting");
          }
          await cx().mutation(api.tasks.submitReport, {
            ...base,
            taskId: id as never,
            description: body.description,
            doing: body.doing,
            location: body.location,
            photos: photos as never,
          });

          // Text/email the issuer: who submitted, the task, and a link.
          try {
            const detail = await cx().query(api.tasks.getTask, {
              secret: secret(),
              orgId: session.orgId as never,
              id: id as never,
              viewerId: session.id as never,
            });
            if (detail) {
              await notifyTaskReportSubmitted(
                session.orgId as string,
                String(detail.task.created_by),
                session.name,
                detail.task.title,
                id
              );
            }
          } catch (e) {
            console.error("[tasks] report notify failed:", e);
          }
          return ok();
        }
        case "comment":
          if (body.text !== undefined) maxLen(body.text, "Comment", 2000);
          await cx().mutation(api.tasks.addComment, { ...base, taskId: id as never, text: body.text ?? "" });
          return ok();
        case "acknowledge":
          if (body.remark !== undefined) maxLen(body.remark, "Remark", 2000);
          await cx().mutation(api.tasks.acknowledge, { ...base, taskId: id as never, remark: body.remark });
          return ok();
        case "reopen":
          if (body.remark !== undefined) maxLen(body.remark, "Remark", 2000);
          await cx().mutation(api.tasks.reopen, { ...base, taskId: id as never, remark: body.remark });
          return ok();
        default:
          throw new HttpError(400, "Unknown action");
      }
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
