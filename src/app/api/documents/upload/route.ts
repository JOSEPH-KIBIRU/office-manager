import { NextRequest } from "next/server";
import path from "path";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, fail } from "@/lib/api";
import { uploadToUploadThing } from "@/lib/uploadthingServer";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED = [".pdf", ".doc", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg", ".webp"];

/** Upload a document file to UploadThing; returns { file_name, file_url, file_key }. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requirePermission("documents", ["admin", "secretary", "manager"]);

    const cl = Number(req.headers.get("content-length") || 0);
    if (cl && cl > MAX_SIZE + 1024 * 1024) return fail(413, "Request body too large");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail(400, "No file provided");
    if (file.size > MAX_SIZE) return fail(400, "File exceeds the 10MB limit");

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED.includes(ext)) return fail(400, `File type not allowed. Allowed: ${ALLOWED.join(", ")}`);

    const uploaded = await uploadToUploadThing(file);
    return ok({ file_name: uploaded.name, file_url: uploaded.url, file_key: uploaded.key });
  });
}
