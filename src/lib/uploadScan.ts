import "server-only";
import crypto from "node:crypto";

export interface ScanResult {
  clean: boolean;
  reason?: string;
  /** True when the scanner itself could not run (as opposed to a malicious verdict). */
  error?: boolean;
}

const MAX_SCAN_BYTES = 20 * 1024 * 1024;
const EXECUTABLE_SIGNATURES: Array<{ label: string; bytes: number[] }> = [
  { label: "Windows executable", bytes: [0x4d, 0x5a] },
  { label: "ELF executable", bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { label: "Mach-O executable", bytes: [0xcf, 0xfa, 0xed, 0xfe] },
  { label: "Mach-O executable", bytes: [0xce, 0xfa, 0xed, 0xfe] },
  { label: "Mach-O executable", bytes: [0xca, 0xfe, 0xba, 0xbe] },
  { label: "Java class file", bytes: [0xca, 0xfe, 0xba, 0xbe] },
];

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function startsWith(buf: Buffer, sig: number[], offset = 0): boolean {
  if (buf.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[offset + i] !== sig[i]) return false;
  }
  return true;
}

function startsWithAscii(buf: Buffer, value: string, offset = 0): boolean {
  return buf.length >= offset + value.length && buf.toString("latin1", offset, offset + value.length) === value;
}

function scanExecutable(buf: Buffer): string | null {
  if (startsWithAscii(buf, "#!")) return "Script files are not allowed";
  for (const sig of EXECUTABLE_SIGNATURES) {
    if (startsWith(buf, sig.bytes)) return `${sig.label}s are not allowed`;
  }
  return null;
}

function scanPdf(buf: Buffer): string | null {
  if (!startsWithAscii(buf, "%PDF-")) return "The file is not a valid PDF";
  const active = ["/JavaScript", "/JS", "/Launch", "/EmbeddedFile", "/RichMedia"];
  for (const marker of active) {
    if (buf.includes(Buffer.from(marker, "latin1"))) {
      return "PDF contains active content (scripts, embedded files or launch actions)";
    }
  }
  return null;
}

function scanSvg(text: string): string | null {
  if (/\u0000/.test(text)) return "Invalid SVG file";
  if (/<\s*script\b/i.test(text)) return "SVG files with scripts are not allowed";
  if (/\son[a-z]+\s*=/i.test(text)) return "SVG files with event handlers are not allowed";
  if (/javascript\s*:/i.test(text)) return "SVG files with javascript: links are not allowed";
  if (/<\s*(iframe|object|embed|foreignObject)\b/i.test(text)) {
    return "SVG files with embedded content are not allowed";
  }
  if (/(?:xlink:)?href\s*=\s*["']\s*(?:https?:|\/\/|data:text\/html)/i.test(text)) {
    return "SVG files with external or HTML links are not allowed";
  }
  return null;
}

function scanZip(buf: Buffer): string | null {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || eocd + 22 > buf.length) return "The file is not a valid Office document";
  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (count === 0 || cdOffset >= buf.length) return "The file is not a valid Office document";

  let offset = cdOffset;
  let totalUncompressed = 0;
  const names: string[] = [];

  for (let i = 0; i < count; i++) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== 0x02014b50) {
      return "The file is not a valid Office document";
    }
    const flags = buf.readUInt16LE(offset + 8);
    if (flags & 1) return "Encrypted Office documents are not allowed";
    const compressed = buf.readUInt32LE(offset + 20);
    const uncompressed = buf.readUInt32LE(offset + 24);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    if (compressed === 0xffffffff || uncompressed === 0xffffffff) {
      return "ZIP64 Office documents are not allowed";
    }
    const end = offset + 46 + nameLen + extraLen + commentLen;
    if (end > buf.length) return "The file is not a valid Office document";
    const name = buf.toString("utf8", offset + 46, offset + 46 + nameLen).toLowerCase();
    names.push(name);
    totalUncompressed += uncompressed;
    if (uncompressed > 50 * 1024 * 1024 || totalUncompressed > 100 * 1024 * 1024) {
      return "Office document expands too large (possible zip bomb)";
    }
    if (compressed > 0 && uncompressed > 1_000_000 && uncompressed / compressed > 200) {
      return "Office document has a suspicious compression ratio (possible zip bomb)";
    }
    offset = end;
  }

  if (names.some((n) => /(^|\/)vbaproject\.bin$/.test(n))) {
    return "Office documents with macros are not allowed";
  }
  if (names.some((n) => /\.(exe|dll|js|vbs|ps1|bat|cmd|scr|com|msi)$/.test(n))) {
    return "Office document contains executable content";
  }
  if (!names.includes("[content_types].xml")) return "The file is not a valid Office document";
  return null;
}

function scanOleDoc(buf: Buffer): string | null {
  if (!startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return "The file is not a valid Word document";
  }
  const ascii = buf.toString("latin1");
  if (/vbaproject|macros/i.test(ascii) || /\bVBA\b/.test(ascii)) {
    return "Word documents with macros are not allowed";
  }
  return null;
}

/** Decrypt a browser-encrypted UploadThing payload (AES-256-GCM). */
export function decryptUploadCipher(cipher: Buffer, encKey: string, iv: string): Buffer {
  const key = Buffer.from(encKey, "base64");
  const ivBytes = Buffer.from(iv, "base64");
  if (key.length !== 32 || ivBytes.length !== 12) throw new Error("Invalid encryption key");
  if (cipher.length < 16) throw new Error("Invalid encrypted file");
  const tag = cipher.subarray(cipher.length - 16);
  const data = cipher.subarray(0, cipher.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, ivBytes);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

async function externalScan(bytes: Buffer, name: string): Promise<ScanResult | null> {
  const url = process.env.UPLOAD_SCAN_URL;
  if (!url) return null;

  const form = new FormData();
  form.append("file", new Blob([bytes as unknown as BlobPart]), name);
  form.append("name", name);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: process.env.UPLOAD_SCAN_TOKEN
        ? { Authorization: `Bearer ${process.env.UPLOAD_SCAN_TOKEN}` }
        : undefined,
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Scanner returned ${res.status}`);
    const data = (await res.json()) as { clean?: boolean; status?: string; reason?: string };
    const clean = data.clean === true || data.status === "clean";
    if (clean) return { clean: true };
    return { clean: false, reason: data.reason || "File flagged by the virus scanner" };
  } catch {
    if (process.env.UPLOAD_SCAN_FAIL_OPEN === "true") return null;
    return {
      clean: false,
      error: true,
      reason: "The virus scanner is unavailable. Please try again later.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Scan an upload before it becomes accessible. Runs local structural checks
 * (magic bytes, executable/script signatures, PDF active content, Office
 * macros/zip bombs, dangerous SVG) and, if UPLOAD_SCAN_URL is configured,
 * forwards the file to an antivirus service.
 */
export async function scanUploadBytes(bytes: Buffer, name: string): Promise<ScanResult> {
  if (bytes.length === 0) return { clean: false, reason: "Empty files are not allowed" };
  if (bytes.length > MAX_SCAN_BYTES) return { clean: false, reason: "File is too large to scan safely" };

  const exec = scanExecutable(bytes);
  if (exec) return { clean: false, reason: exec };

  const ext = extensionOf(name);
  let local: string | null = null;

  switch (ext) {
    case ".pdf":
      local = scanPdf(bytes);
      break;
    case ".png":
      if (!startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        local = "The file is not a valid PNG image";
      }
      break;
    case ".jpg":
    case ".jpeg":
      if (!startsWith(bytes, [0xff, 0xd8, 0xff])) local = "The file is not a valid JPEG image";
      break;
    case ".gif":
      if (!startsWithAscii(bytes, "GIF87a") && !startsWithAscii(bytes, "GIF89a")) {
        local = "The file is not a valid GIF image";
      }
      break;
    case ".webp":
      if (!startsWithAscii(bytes, "RIFF") || bytes.toString("latin1", 8, 12) !== "WEBP") {
        local = "The file is not a valid WEBP image";
      }
      break;
    case ".docx": {
      if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) local = "The file is not a valid Word document";
      else local = scanZip(bytes);
      break;
    }
    case ".doc":
      local = scanOleDoc(bytes);
      break;
    case ".svg":
      local = scanSvg(bytes.toString("utf8"));
      break;
    case ".txt":
    case ".md":
      if (bytes.includes(0)) local = "Text file contains binary data";
      break;
    default:
      local = "File type not allowed";
  }

  if (local) return { clean: false, reason: local };

  const external = await externalScan(bytes, name);
  return external ?? { clean: true };
}
