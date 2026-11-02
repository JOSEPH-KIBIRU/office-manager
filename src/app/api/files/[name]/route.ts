import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { requireUser } from "@/lib/auth";
import { cx, secret, api } from "@/lib/convex";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  let session;
  try {
    session = await requireUser();
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { name } = await ctx.params;
  // `name` is now a Convex storage id (e.g. "k57...").
  if (!/^[a-zA-Z0-9]+$/.test(name)) {
    return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
  }

  let url: string | null;
  try {
    url = await cx().mutation(api.storage.getFileUrl, {
      secret: secret(),
      orgId: session.orgId as never,
      id: name as never,
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  if (!url) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const ext = path.extname(name).toLowerCase();
  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? MIME[ext] ?? "application/octet-stream");
  // Sanitise the caller-supplied display name: strip control chars, quotes,
  // slashes and backslashes to avoid header injection or odd downloads.
  const original = _req.nextUrl.searchParams.get("as") ?? "";
  const safeName =
    (original || name)
      .replace(/[\x00-\x1f\x7f"\\/]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || name;
  headers.set("Content-Disposition", `attachment; filename="${safeName}"`);

  return new NextResponse(upstream.body, { status: 200, headers });
}
