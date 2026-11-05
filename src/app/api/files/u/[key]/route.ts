import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { cx, secret, api } from "@/lib/convex";
import { privateUploadThingAclEnabled, signedUploadThingUrl } from "@/lib/uploadthingServer";

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

  let file: { url: string; name: string | null; type: string | null } | null;
  try {
    file = (await cx().query(api.storage.getFileByKey, {
      secret: secret(),
      orgId: session.orgId as never,
      key,
    })) as { url: string; name: string | null; type: string | null } | null;
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  if (!file?.url) {
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
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") ?? file.type ?? "application/octet-stream"
  );
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  const download = req.nextUrl.searchParams.get("download") === "1";
  headers.set(
    "Content-Disposition",
    `${download ? "attachment" : "inline"}; filename="${safeFileName(file.name)}"`
  );

  return new NextResponse(upstream.body, { status: 200, headers });
}
