import { NextRequest } from "next/server";
import path from "path";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, fail } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { uploadToUploadThing } from "@/lib/uploadthingServer";

const MAX_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

/**
 * Upload a task photo to UploadThing. The returned CDN URL is stored on the
 * task update; the bytes never enter the Convex database.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("tasks", ["admin", "secretary", "manager", "employee"]);

    const cl = Number(req.headers.get("content-length") || 0);
    if (cl && cl > MAX_SIZE + 1024 * 1024) return fail(413, "Request body too large");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail(400, "No file provided");
    if (file.size > MAX_SIZE) return fail(400, "File exceeds the 8MB limit");

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED.includes(ext)) {
      return fail(400, `Image type not allowed. Allowed: ${ALLOWED.join(", ")}`);
    }

    const uploaded = await uploadToUploadThing(file);

    try {
      await cx().mutation(api.storage.registerFile, {
        secret: secret(),
        orgId: session.orgId as never,
        url: uploaded.url,
        key: uploaded.key,
        name: uploaded.name,
        size: uploaded.size,
        type: uploaded.type,
        kind: "task",
      });
    } catch (e) {
      return mapConvexError(e);
    }

    return ok({ url: uploaded.url, key: uploaded.key, name: uploaded.name });
  });
}
