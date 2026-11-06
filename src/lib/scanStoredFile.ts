import "server-only";
import { cx, secret, api } from "./convex";
import { decryptToken } from "./email/crypto";
import {
  privateUploadThingAclEnabled,
  signedUploadThingUrl,
  deleteUploadThingFiles,
} from "./uploadthingServer";
import { decryptUploadCipher, scanUploadBytes, type ScanResult } from "./uploadScan";

export interface FileRow {
  url: string;
  name: string | null;
  type: string | null;
  encrypted: boolean;
  encKeyEnc: string | null;
  encIv: string | null;
  scanStatus: "pending" | "clean" | "infected" | "error" | null;
  scanReason: string | null;
}

/** Fetch ciphertext by key, choosing public or signed access. */
export async function fetchUploadCipherByKey(key: string, row: FileRow): Promise<Buffer> {
  const target = privateUploadThingAclEnabled() ? await signedUploadThingUrl(key) : row.url;
  if (!target) throw new Error("File has no CDN URL");
  const res = await fetch(target, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not read uploaded file");
  return Buffer.from(await res.arrayBuffer());
}

/** Decrypt and scan an encrypted upload before its key is stored. */
export async function scanEncryptedBytes(
  cipher: Buffer,
  encKey: string,
  iv: string,
  name: string
): Promise<ScanResult> {
  try {
    const plain = decryptUploadCipher(cipher, encKey, iv);
    return await scanUploadBytes(plain, name);
  } catch {
    return { clean: false, error: true, reason: "Could not decrypt the uploaded file" };
  }
}

/**
 * Scan an already-registered file (used for logos and any file that was not
 * scanned at encryption time). Updates scanStatus and deletes infected files.
 */
export async function scanStoredFile(key: string, orgId: string): Promise<ScanResult> {
  const row = (await cx().query(api.storage.getFileByKey, {
    secret: secret(),
    orgId: orgId as never,
    key,
  })) as FileRow | null;

  if (!row) return { clean: false, reason: "File not found" };
  if (row.scanStatus === "clean") return { clean: true };
  if (row.scanStatus === "infected") {
    return { clean: false, reason: row.scanReason || "This file was blocked by the scanner" };
  }

  let cipher: Buffer;
  try {
    cipher = await fetchUploadCipherByKey(key, row);
  } catch {
    return { clean: false, error: true, reason: "Could not read uploaded file" };
  }

  let plain = cipher;
  if (row.encrypted) {
    if (!row.encKeyEnc || !row.encIv) {
      return { clean: false, error: true, reason: "Missing encryption key" };
    }
    try {
      plain = decryptUploadCipher(cipher, decryptToken(row.encKeyEnc), row.encIv);
    } catch {
      await blockFile(key, orgId, "error", "Could not decrypt the uploaded file");
      return { clean: false, error: true, reason: "Could not verify the uploaded file" };
    }
  }

  const result = await scanUploadBytes(plain, row.name ?? "file");
  await recordScan(key, orgId, result);
  if (!result.clean && !result.error) await deleteUploadThingFiles(key);
  return result;
}

async function recordScan(key: string, orgId: string, result: ScanResult) {
  await cx().mutation(api.storage.setFileScanStatus, {
    secret: secret(),
    orgId: orgId as never,
    key,
    status: result.clean ? "clean" : result.error ? "error" : "infected",
    reason: result.reason ?? null,
  });
}

async function blockFile(
  key: string,
  orgId: string,
  status: "infected" | "error",
  reason: string
) {
  try {
    await cx().mutation(api.storage.setFileScanStatus, {
      secret: secret(),
      orgId: orgId as never,
      key,
      status,
      reason,
    });
    await deleteUploadThingFiles(key);
  } catch {
    /* best effort */
  }
}
