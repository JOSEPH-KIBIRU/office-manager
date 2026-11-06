import { NextRequest } from "next/server";
import path from "path";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, fail } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { uploadToUploadThing } from "@/lib/uploadthingServer";
import { uploadThingProxyPath } from "@/lib/fileUrls";
import { scanUploadBytes } from "@/lib/uploadScan";
export const maxDuration = 60;

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED = [".pdf", ".doc", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg"];

/** Server-side fallback upload (the UI uploads directly via UploadThing). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("minutes", ["admin", "secretary"]);

    const cl = Number(req.headers.get("content-length") || 0);
    if (cl && cl > MAX_SIZE + 1024 * 1024) return fail(413, "Request body too large");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail(400, "No file provided");
    if (file.size > MAX_SIZE) return fail(400, "File exceeds the 10MB limit");

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED.includes(ext)) {
      return fail(400, `File type not allowed. Allowed: ${ALLOWED.join(", ")}`);
    }

    const scan = await scanUploadBytes(Buffer.from(await file.arrayBuffer()), file.name);
    if (!scan.clean) {
      return fail(scan.error ? 503 : 422, scan.reason || "File rejected by the scanner");
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
        kind: "minutes",
        scanStatus: "clean",
      });
    } catch (e) {
      return mapConvexError(e);
    }

    return ok({
      file_name: uploaded.name,
      file_url: uploadThingProxyPath(uploaded.key),
      file_key: uploaded.key,
    });
  });
}
