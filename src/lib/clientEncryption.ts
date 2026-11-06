import { uploadThingProxyPath } from "@/lib/fileUrls";

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function base64ToBytes(value: string): Uint8Array {
  const raw = atob(value);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export interface EncryptedUpload {
  file: File;
  key: string;
  iv: string;
  name: string;
  mime: string;
}

/** Encrypt a file in the browser before it is sent to UploadThing. */
export async function encryptFile(file: File): Promise<EncryptedUpload> {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    await file.arrayBuffer()
  );
  const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  return {
    file: new File([cipher], file.name, {
      type: file.type || "application/octet-stream",
      lastModified: file.lastModified,
    }),
    key: bytesToBase64(rawKey),
    iv: bytesToBase64(iv),
    name: file.name,
    mime: file.type || "application/octet-stream",
  };
}

export interface SecureFile {
  blob: Blob;
  name: string;
}

/** Fetch the per-file key, download the ciphertext and decrypt it locally. */
export async function loadEncryptedFile(fileKey: string): Promise<SecureFile | null> {
  const metaRes = await fetch(`/api/files/key?key=${encodeURIComponent(fileKey)}`, {
    cache: "no-store",
  });
  if (!metaRes.ok) throw new Error("Could not open this file");
  const meta = (await metaRes.json()) as {
    encrypted: boolean;
    key?: string;
    iv?: string;
    url?: string;
    name?: string | null;
    type?: string | null;
  };
  if (!meta.encrypted) return null;
  if (!meta.key || !meta.iv) throw new Error("This file has no decryption key");

  let cipherRes: Response | null = null;
  if (meta.url) {
    try {
      const res = await fetch(meta.url, { cache: "no-store" });
      if (res.ok) cipherRes = res;
    } catch {
      /* CORS or network fallback below */
    }
  }
  if (!cipherRes) {
    const res = await fetch(uploadThingProxyPath(fileKey), { cache: "no-store" });
    if (res.ok) cipherRes = res;
  }
  if (!cipherRes) throw new Error("Could not download this file");

  const iv = base64ToBytes(meta.iv) as unknown as BufferSource;
  const rawKey = base64ToBytes(meta.key) as unknown as BufferSource;
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["decrypt"]),
    await cipherRes.arrayBuffer()
  );

  return {
    blob: new Blob([plain], { type: meta.type || "application/octet-stream" }),
    name: meta.name || "file",
  };
}
