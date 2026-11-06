import "server-only";
import { cx, secret, api } from "./convex";
import { getUploadThingFileUrl } from "./uploadthingServer";

export interface EnsuredUpload {
  url: string;
  name: string | null;
  type: string | null;
  encrypted: boolean;
  encKeyEnc: string | null;
  encIv: string | null;
  scanStatus: "pending" | "clean" | "infected" | "error" | null;
  scanReason: string | null;
}

/**
 * Make sure an UploadThing key is registered to this org. The UploadThing
 * onUploadComplete callback normally does this, but it can race with the
 * immediate /api/files/encrypt or logo-save request. If the row is missing we
 * resolve the CDN URL from UploadThing and register it as pending.
 */
export async function ensureUploadFileRegistered(opts: {
  key: string;
  orgId: string;
  kind: "logo" | "minutes" | "task" | "other";
  name?: string;
  type?: string;
}): Promise<EnsuredUpload | null> {
  const existing = (await cx().query(api.storage.getFileByKey, {
    secret: secret(),
    orgId: opts.orgId as never,
    key: opts.key,
  })) as EnsuredUpload | null;
  if (existing) return existing;

  const url = await getUploadThingFileUrl(opts.key);
  if (!url) return null;

  await cx().mutation(api.storage.registerFile, {
    secret: secret(),
    orgId: opts.orgId as never,
    url,
    key: opts.key,
    name: opts.name,
    type: opts.type,
    kind: opts.kind,
    scanStatus: "pending",
  });

  return {
    url,
    name: opts.name ?? null,
    type: opts.type ?? null,
    encrypted: false,
    encKeyEnc: null,
    encIv: null,
    scanStatus: "pending",
    scanReason: null,
  };
}
