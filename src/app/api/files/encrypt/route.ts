import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { encryptToken } from "@/lib/email/crypto";
import { mimeForName } from "@/lib/mime";
import { fetchUploadCipherByKey, scanEncryptedBytes, type FileRow } from "@/lib/scanStoredFile";
import { deleteUploadThingFiles } from "@/lib/uploadthingServer";
import { ensureUploadFileRegistered } from "@/lib/ensureUploadFile";

export const maxDuration = 60;

function decodeBase64(value: string, expectedBytes: number, label: string): void {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new HttpError(400, `Invalid ${label}`);
  const bytes = Buffer.from(value, "base64");
  if (bytes.length !== expectedBytes) throw new HttpError(400, `Invalid ${label}`);
}

/**
 * Verify, decrypt and scan a freshly uploaded file before storing its AES key.
 * Malicious/unsafe files are quarantined (deleted) and never become accessible.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser();
    const body = await readJson<{
      key: string;
      encKey: string;
      iv: string;
      name: string;
      kind?: string;
    }>(req);
    requireFields(body, ["key", "encKey", "iv", "name"]);
    const kind =
      body.kind === "task" || body.kind === "minutes" || body.kind === "logo"
        ? body.kind
        : "other";

    const key = String(body.key);
    if (!key || key.length > 512 || /[\/\\\x00-\x1f]/.test(key)) {
      throw new HttpError(400, "Invalid file key");
    }
    decodeBase64(String(body.encKey), 32, "encryption key");
    decodeBase64(String(body.iv), 12, "encryption IV");

    const name = String(body.name)
      .replace(/[\x00-\x1f\x7f"\\/]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140);
    if (!name) throw new HttpError(400, "Invalid file name");
    const type = mimeForName(name);
    if (!type) throw new HttpError(400, "Unsupported file type");

    const row = (await ensureUploadFileRegistered({
      key,
      orgId: session.orgId as string,
      kind,
      name,
      type,
    })) as FileRow | null;
    if (!row) throw new HttpError(404, "Uploaded file not found. Please try the upload again.");
    if (row.scanStatus === "infected") {
      throw new HttpError(422, row.scanReason || "This file was blocked by the scanner");
    }
    if (row.encrypted && row.scanStatus === "clean") return ok({ ok: true });

    let cipher: Buffer;
    try {
      cipher = await fetchUploadCipherByKey(key, row);
    } catch {
      throw new HttpError(503, "Could not read the uploaded file for scanning");
    }

    const scan = await scanEncryptedBytes(cipher, String(body.encKey), String(body.iv), name);
    if (!scan.clean) {
      try {
        await cx().mutation(api.storage.setFileScanStatus, {
          secret: secret(),
          orgId: session.orgId as never,
          key,
          status: scan.error ? "error" : "infected",
          reason: scan.reason ?? null,
        });
      } catch {
        /* best effort */
      }
      if (!scan.error) await deleteUploadThingFiles(key);
      throw new HttpError(scan.error ? 503 : 422, scan.reason || "File rejected by the scanner");
    }

    try {
      await cx().mutation(api.storage.setFileEncryption, {
        secret: secret(),
        orgId: session.orgId as never,
        key,
        encKeyEnc: encryptToken(String(body.encKey)),
        encIv: String(body.iv),
        name,
        type,
        scanStatus: "clean",
        scanReason: null,
      });
    } catch (e) {
      return mapConvexError(e);
    }

    return ok({ ok: true });
  });
}
