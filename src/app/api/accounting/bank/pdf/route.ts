import { NextRequest } from "next/server";
import path from "path";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok, fail } from "@/lib/api";
import { getDocument, type PdfTextItem } from "pdfjs-dist/legacy/build/pdf.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 12 * 1024 * 1024; // 12MB
const MAX_PAGES = 60;

/**
 * Extract text lines from an uploaded bank / M-Pesa PDF statement. We group the
 * PDF text items by their vertical position so each visual row becomes one
 * string, which the client then parses into date/description/amount lines for
 * review. Nothing is written to the ledger here.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requirePermission("accounting", ["admin", "secretary"]);

    const cl = Number(req.headers.get("content-length") || 0);
    if (cl && cl > MAX_SIZE + 1024 * 1024) return fail(413, "PDF is too large");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail(400, "No file provided");
    if (file.size > MAX_SIZE) return fail(400, "PDF exceeds the 12MB limit");

    const buf = new Uint8Array(await file.arrayBuffer());
    let doc;
    try {
      doc = await getDocument({
        data: buf,
        useWorkerFetch: false,
        isEvalSupported: false,
        disableFontFace: true,
        useSystemFonts: false,
        verbosity: 0,
        standardFontDataUrl: path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts") + path.sep,
      }).promise;
    } catch (e) {
      console.error("[bank/pdf] extraction failed:", e);
      return fail(400, "Could not read that PDF. Is it a valid, unlocked statement?");
    }

    const lines: string[] = [];
    const pages = Math.min(doc.numPages, MAX_PAGES);
    for (let p = 1; p <= pages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const rows = new Map<number, { x: number; str: string }[]>();
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const t = item as PdfTextItem;
        if (!t.str || !t.str.trim()) continue;
        const y = Math.round(t.transform[5]);
        const x = t.transform[4];
        const arr = rows.get(y) ?? [];
        arr.push({ x, str: t.str });
        rows.set(y, arr);
      }
      const ys = [...rows.keys()].sort((a, b) => b - a); // top → bottom
      for (const y of ys) {
        const text = rows
          .get(y)!
          .sort((a, b) => a.x - b.x)
          .map((i) => i.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (text) lines.push(text);
      }
    }

    return ok({ lines });
  });
}
