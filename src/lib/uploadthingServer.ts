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
  const opts = privateUploadThingAclEnabled() ? ({ acl: "private" } as const) : undefined;
  const result = await utapi().uploadFiles(file, opts);
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

/** True once the UploadThing app is upgraded and private ACL is enabled. */
export function privateUploadThingAclEnabled(): boolean {
  return process.env.UPLOADTHING_PRIVATE === "true";
}

/** Short-lived signed URL for a private UploadThing file. */
export async function signedUploadThingUrl(key: string): Promise<string> {
  const res = await utapi().generateSignedURL(key, { expiresIn: "5m" });
  return res.ufsUrl;
}

/** Resolve an uploaded key to its CDN URL via the UploadThing API. */
export async function getUploadThingFileUrl(key: string): Promise<string | null> {
  try {
    const res = await utapi().getFileUrls(key);
    const row = res.data.find((file) => file.key === key) ?? res.data[0];
    return row?.url ?? null;
  } catch {
    return null;
  }
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
