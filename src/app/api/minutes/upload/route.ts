import { NextRequest } from "next/server";
import path from "path";
import { requireUser } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED = [".pdf", ".doc", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg"];

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin", "secretary"]);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail(400, "No file provided");
    if (file.size > MAX_SIZE) return fail(400, "File exceeds the 10MB limit");

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED.includes(ext)) {
      return fail(400, `File type not allowed. Allowed: ${ALLOWED.join(", ")}`);
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

      return ok({ file_name: file.name, file_path: storageId });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
