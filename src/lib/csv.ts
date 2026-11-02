/**
 * CSV helpers. `csvCell` escapes values for CSV and neutralises spreadsheet
 * formula injection: cells starting with = + @ (and non-numeric strings starting
 * with -) are prefixed with an apostrophe so Excel/Sheets treat them as text.
 */
export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (typeof value === "string") {
    const dangerousStart = /^[=+@\t\r]/.test(s);
    const dangerousMinus = /^-/.test(s) && !/^-?\d+(\.\d+)?$/.test(s);
    if (dangerousStart || dangerousMinus) s = "'" + s;
  }
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** A cell safe to embed in an HTML-table `.xls` export. */
export function htmlCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (typeof value === "string") {
    const dangerousStart = /^[=+@\t\r]/.test(s);
    const dangerousMinus = /^-/.test(s) && !/^-?\d+(\.\d+)?$/.test(s);
    if (dangerousStart || dangerousMinus) s = "'" + s;
  }
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
