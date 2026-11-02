import ExcelJS from "exceljs";
import { HttpError } from "./httpError";

const MAX_ROWS = 5000;

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.text === "string") return v.text.trim();
    if (Array.isArray(v.richText)) {
      return v.richText
        .map((r) => (r && typeof r === "object" ? String((r as { text?: string }).text ?? "") : ""))
        .join("")
        .trim();
    }
    if (v.result != null) return String(v.result).trim();
    if (typeof v.hyperlink === "string") return v.hyperlink.trim();
  }
  return String(value).trim();
}

/**
 * Parse an XLSX/XLSM workbook into rows of strings. Uses ExcelJS (maintained)
 * instead of the unpatched SheetJS build. Caps the number of rows to avoid
 * resource-exhaustion from a crafted upload.
 */
export async function xlsxToRows(buf: Uint8Array): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buf) as never);

  const out: string[][] = [];
  let total = 0;
  workbook.eachSheet((sheet) => {
    sheet.eachRow({ includeEmpty: false }, (row) => {
      total += 1;
      if (total > MAX_ROWS) {
        throw new HttpError(413, "Spreadsheet has too many rows (max 5,000).");
      }
      const values = row.values as unknown[];
      const cells: string[] = [];
      for (let i = 1; i < values.length; i++) cells.push(cellText(values[i]));
      out.push(cells);
    });
  });

  return out.filter((r) => r.some((c) => c.length > 0));
}
