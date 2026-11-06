import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { encryptToken } from "@/lib/email/crypto";
import { mimeForName } from "@/lib/mime";

function decodeBase64(value: string, expectedBytes: number, label: string): void {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new HttpError(400, `Invalid ${label}`);
  const bytes = Buffer.from(value, "base64");
  if (bytes.length !== expectedBytes) throw new HttpError(400, `Invalid ${label}`);
}

/**
 * Store the client-generated AES key for a freshly uploaded file. The key is
 * encrypted with TOKEN_ENCRYPTION_KEY before it is written to Convex.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser();
    const body = await readJson<{ key: string; encKey: string; iv: string; name: string }>(req);
    requireFields(body, ["key", "encKey", "iv", "name"]);

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

    const row = (await cx().query(api.storage.getFileByKey, {
      secret: secret(),
      orgId: session.orgId as never,
      key,
    })) as { encrypted: boolean } | null;
    if (!row) throw new HttpError(404, "File not found");
    if (row.encrypted) return ok({ ok: true });

    try {
      await cx().mutation(api.storage.setFileEncryption, {
        secret: secret(),
        orgId: session.orgId as never,
        key,
        encKeyEnc: encryptToken(String(body.encKey)),
        encIv: String(body.iv),
        name,
        type,
      });
    } catch (e) {
      return mapConvexError(e);
    }

    return ok({ ok: true });
  });
}
