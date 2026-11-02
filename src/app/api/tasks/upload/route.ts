import { NextRequest } from "next/server";
import path from "path";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, fail } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

const MAX_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

/**
 * Upload a task photo to Convex storage. The returned URL goes through
 * /api/files, which enforces the tenant + session (unlike public CDN URLs).
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

    try {
      const uploadUrl = await cx().mutation(api.storage.generateUploadUrl, { secret: secret() });
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: await file.arrayBuffer(),
      });
      if (!res.ok) throw new Error(`File upload failed (${res.status})`);
      const { storageId } = (await res.json()) as { storageId: string };

      await cx().mutation(api.storage.registerFile, {
        secret: secret(),
        orgId: session.orgId as never,
        storageId: storageId as never,
        kind: "task",
      });

      return ok({
        storageId,
        url: `/api/files/${storageId}?as=${encodeURIComponent(file.name)}`,
        name: file.name,
      });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
