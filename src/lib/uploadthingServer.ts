import "server-only";
import { UTApi } from "uploadthing/server";

export interface UploadedFileInfo {
  url: string;
  key: string;
  name: string;
  size: number;
  type: string;
}

function utapi(): UTApi {
  const token = process.env.UPLOADTHING_TOKEN;
  if (!token) throw new Error("UPLOADTHING_TOKEN is not configured");
  return new UTApi({ token });
}

/** Upload a file to UploadThing. The bytes live in UploadThing, not Convex. */
export async function uploadToUploadThing(file: File): Promise<UploadedFileInfo> {
  const result = await utapi().uploadFiles(file);
  if (result.error) throw new Error(result.error.message || "UploadThing upload failed");
  const data = result.data;
  return {
    url: data.ufsUrl,
    key: data.key,
    name: data.name,
    size: data.size,
    type: data.type,
  };
}

/** Best-effort delete of one or more UploadThing files. */
export async function deleteUploadThingFiles(
  keys: string | string[] | null | undefined
): Promise<void> {
  const list = (Array.isArray(keys) ? keys : keys ? [keys] : []).filter(Boolean);
  if (list.length === 0) return;
  try {
    await utapi().deleteFiles(list);
  } catch {
    /* orphaned files are harmless; never fail the DB operation for this */
  }
}
