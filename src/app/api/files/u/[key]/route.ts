import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { cx, secret, api } from "@/lib/convex";
import { privateUploadThingAclEnabled, signedUploadThingUrl } from "@/lib/uploadthingServer";
import { INLINE_MIME, safeMime } from "@/lib/mime";

const ALLOWED_HOSTS = /(^|\.)(ufs\.sh|utfs\.io|uploadthing\.com)$/i;

function safeFileName(name: string | null | undefined): string {
  return (name || "file")
    .replace(/[\x00-\x1f\x7f"\\/]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

/**
 * Authenticated UploadThing proxy. Requires a valid session and proves the
 * file key belongs to the caller's organization before fetching from the CDN.
 * The CDN URL is never exposed to the browser.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  let session;
  try {
    session = await requireUser();
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { key } = await ctx.params;
  if (!key || key.length > 512 || /[\/\\\x00-\x1f]/.test(key)) {
    return NextResponse.json({ error: "Invalid file key" }, { status: 400 });
  }

  let file: { url: string; name: string | null; type: string | null; encrypted: boolean; scanStatus: "pending" | "clean" | "infected" | "error" | null; scanReason: string | null } | null;
  try {
    file = (await cx().query(api.storage.getFileByKey, {
      secret: secret(),
      orgId: session.orgId as never,
      key,
    })) as { url: string; name: string | null; type: string | null; encrypted: boolean; scanStatus: "pending" | "clean" | "infected" | "error" | null; scanReason: string | null } | null;
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  if (file.scanStatus === "infected") {
    return NextResponse.json(
      { error: file.scanReason || "This file was blocked by the scanner" },
      { status: 403 }
    );
  }
  if (file.scanStatus === "pending") {
    return NextResponse.json({ error: "This file is still being scanned" }, { status: 409 });
  }
  if (file.scanStatus === "error") {
    return NextResponse.json(
      { error: file.scanReason || "This file could not be scanned" },
      { status: 503 }
    );
  }
  if (!file.url && !privateUploadThingAclEnabled()) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  let target: string;
  try {
    target = privateUploadThingAclEnabled() ? await signedUploadThingUrl(key) : file.url;
  } catch {
    return NextResponse.json({ error: "File is temporarily unavailable" }, { status: 502 });
  }

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return NextResponse.json({ error: "File is temporarily unavailable" }, { status: 502 });
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.test(url.hostname)) {
    return NextResponse.json({ error: "File is temporarily unavailable" }, { status: 502 });
  }

  const upstream = await fetch(url, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const headers = new Headers();
  const contentType = safeMime(file.name, upstream.headers.get("content-type"));
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  const download = req.nextUrl.searchParams.get("download") === "1";
  const inline = !download && !file.encrypted && INLINE_MIME.has(contentType);
  headers.set(
    "Content-Disposition",
    `${inline ? "inline" : "attachment"}; filename="${safeFileName(file.name)}"`
  );
  if (contentType === "image/svg+xml") {
    headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
  }

  return new NextResponse(upstream.body, { status: 200, headers });
}
