import { NextRequest } from "next/server";
import path from "path";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, fail } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { uploadToUploadThing } from "@/lib/uploadthingServer";
import { uploadThingProxyPath } from "@/lib/fileUrls";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED = [".png", ".jpg", ".jpeg", ".svg", ".webp"];

/** Server-side fallback upload (the UI uploads directly via UploadThing). */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requirePermission("organization", ["admin", "secretary"]);

    const cl = Number(req.headers.get("content-length") || 0);
    if (cl && cl > MAX_SIZE + 1024 * 1024) return fail(413, "Request body too large");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail(400, "No file provided");
    if (file.size > MAX_SIZE) return fail(400, "Logo exceeds the 5MB limit");

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED.includes(ext)) {
      return fail(400, `Logo type not allowed. Allowed: ${ALLOWED.join(", ")}`);
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
        kind: "logo",
      });
    } catch (e) {
      return mapConvexError(e);
    }

    return ok({ url: uploadThingProxyPath(uploaded.key), key: uploaded.key });
  });
}
