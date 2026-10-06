import { NextRequest } from "next/server";
import path from "path";
import * as XLSX from "xlsx";
import { getDocument, type PdfTextItem } from "pdfjs-dist/legacy/build/pdf.mjs";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { parseDelimited, normalizeStatementDetailed } from "@/lib/bankImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 15 * 1024 * 1024; // 15MB
const MAX_PDF_PAGES = 80;

/** Group PDF text items into visual rows, splitting columns on large x-gaps. */
async function pdfToRows(buf: Uint8Array, password?: string | null): Promise<string[][]> {
  const doc = await getDocument({
    data: buf,
    password: password || undefined,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
    standardFontDataUrl: path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts") + path.sep,
  }).promise;

  const rows: string[][] = [];
  const pages = Math.min(doc.numPages, MAX_PDF_PAGES);
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const byRow = new Map<number, { x: number; w: number; str: string }[]>();
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const t = item as PdfTextItem;
      if (!t.str || !t.str.trim()) continue;
      const y = Math.round(t.transform[5] / 3) * 3; // bucket y to group rows
      const arr = byRow.get(y) ?? [];
      arr.push({ x: t.transform[4], w: (t as unknown as { width?: number }).width ?? 0, str: t.str });
      byRow.set(y, arr);
    }
    const ys = [...byRow.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const items = byRow.get(y)!.sort((a, b) => a.x - b.x);
      const cols: string[] = [];
      let cur = "";
      let prevEnd: number | null = null;
      for (const it of items) {
        const gap = prevEnd === null ? 0 : it.x - prevEnd;
        if (prevEnd !== null && gap > 6) {
          cols.push(cur.trim());
          cur = it.str;
        } else {
          cur += (cur ? " " : "") + it.str;
        }
        prevEnd = it.x + (it.w || it.str.length * 4);
      }
      if (cur.trim()) cols.push(cur.trim());
      const cleaned = cols.filter((c) => c.length > 0);
      if (cleaned.length) rows.push(cleaned);
    }
  }
  return rows;
}

function xlsxToRows(buf: Uint8Array): string[][] {
  const wb = XLSX.read(buf, { type: "array" });
  const out: string[][] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
    for (const r of rows) out.push((r as unknown[]).map((c) => (c == null ? "" : String(c).trim())));
  }
  return out.filter((r) => r.some((c) => c.length > 0));
}

/**
 * POST /api/banking/import-file
 * multipart: file=<csv|xlsx|xls|pdf|txt>
 * Parses the file into normalized transactions (date/description/signed amount)
 * and returns them for review before importing.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requirePermission("accounting-post", ["admin", "secretary"]);

    const cl = Number(req.headers.get("content-length") || 0);
    if (cl && cl > MAX_SIZE + 1024 * 1024) throw new HttpError(413, "File is too large (max 15MB).");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "No file provided.");
    if (file.size > MAX_SIZE) throw new HttpError(400, "File exceeds the 15MB limit.");

    const name = (file.name || "").toLowerCase();
    const ext = name.split(".").pop() || "";
    const buf = new Uint8Array(await file.arrayBuffer());
    const password = form.get("password");
    const passwordStr = typeof password === "string" ? password : "";

    let rows: string[][];
    try {
      if (ext === "csv" || ext === "tsv" || ext === "txt") {
        rows = parseDelimited(new TextDecoder().decode(buf));
      } else if (ext === "xlsx" || ext === "xls" || ext === "xlsm") {
        rows = xlsxToRows(buf);
      } else if (ext === "pdf") {
        try {
          rows = await pdfToRows(buf, passwordStr);
        } catch (e) {
          // pdfjs throws a PasswordException when the PDF is encrypted.
          const err = e as { name?: string; code?: number };
          if (err?.name === "PasswordException") {
            return ok({ needsPassword: true, transactions: [], count: 0, wrongPassword: !!passwordStr });
          }
          throw e;
        }
      } else {
        // Best-effort: try text, then excel.
        const text = new TextDecoder().decode(buf);
        rows = text.includes("\u0000") ? xlsxToRows(buf) : parseDelimited(text);
      }
    } catch (e) {
      console.error("[banking/import-file] parse failed:", e);
      throw new HttpError(400, "Could not read that file. Supported: CSV, Excel (.xlsx/.xls) and PDF statements.");
    }

    const { transactions, detected } = normalizeStatementDetailed(rows);
    if (transactions.length === 0) {
      throw new HttpError(
        422,
        "No transactions could be detected. Check the file has Date and Debit/Credit (or Amount) columns."
      );
    }
    return ok({
      transactions,
      count: transactions.length,
      detected,
      preview: rows.slice(0, 5),
    });
  });
}
