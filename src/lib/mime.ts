export const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export const INLINE_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "text/plain",
]);

/** Safe content type derived from the file name (never trust user MIME). */
export function mimeForName(name: string | null | undefined): string {
  const dot = (name ?? "").lastIndexOf(".");
  const ext = dot >= 0 ? (name as string).slice(dot).toLowerCase() : "";
  return MIME_BY_EXT[ext] ?? "";
}

/** Safe type for serving: extension first, then an allowlisted upstream type. */
export function safeMime(name: string | null | undefined, upstream: string | null): string {
  const byExt = mimeForName(name);
  if (byExt) return byExt;
  const up = (upstream ?? "").split(";")[0].trim().toLowerCase();
  if (INLINE_MIME.has(up) || up === "application/octet-stream") return up;
  return "application/octet-stream";
}
