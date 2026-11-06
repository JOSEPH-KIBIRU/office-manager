import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { cx, secret, api } from "@/lib/convex";
import { decryptToken } from "@/lib/email/crypto";
import { uploadThingProxyPath } from "@/lib/fileUrls";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Return the decryption material for an authorized file. The AES key is only
 * released to a signed-in member of the owning organization; the ciphertext
 * itself is useless without it.
 */
export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireUser();
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: NO_STORE });
  }

  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!key || key.length > 512 || /[\/\\\x00-\x1f]/.test(key)) {
    return NextResponse.json({ error: "Invalid file key" }, { status: 400, headers: NO_STORE });
  }

  let row: {
    url: string;
    name: string | null;
    type: string | null;
    encrypted: boolean;
    encKeyEnc: string | null;
    encIv: string | null;
    scanStatus: "pending" | "clean" | "infected" | "error" | null;
    scanReason: string | null;
  } | null;
  try {
    row = (await cx().query(api.storage.getFileByKey, {
      secret: secret(),
      orgId: session.orgId as never,
      key,
    })) as typeof row;
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404, headers: NO_STORE });
  }
  if (!row) {
    return NextResponse.json({ error: "File not found" }, { status: 404, headers: NO_STORE });
  }
  if (row.scanStatus === "infected") {
    return NextResponse.json(
      { error: row.scanReason || "This file was blocked by the scanner" },
      { status: 403, headers: NO_STORE }
    );
  }
  if (row.scanStatus === "pending") {
    return NextResponse.json(
      { error: "This file is still being scanned" },
      { status: 409, headers: NO_STORE }
    );
  }
  if (row.scanStatus === "error") {
    return NextResponse.json(
      { error: row.scanReason || "This file could not be scanned" },
      { status: 503, headers: NO_STORE }
    );
  }

  if (!row.encrypted || !row.encKeyEnc || !row.encIv) {
    return NextResponse.json(
      {
        encrypted: false,
        url: uploadThingProxyPath(key),
        name: row.name,
        type: row.type,
      },
      { headers: NO_STORE }
    );
  }

  let rawKey: string;
  try {
    rawKey = decryptToken(row.encKeyEnc);
  } catch {
    return NextResponse.json(
      { error: "File decryption is not configured" },
      { status: 500, headers: NO_STORE }
    );
  }

  return NextResponse.json(
    {
      encrypted: true,
      key: rawKey,
      iv: row.encIv,
      url: row.url,
      name: row.name,
      type: row.type,
    },
    { headers: NO_STORE }
  );
}
