/**
 * Bank / M-Pesa statement normalization.
 *
 * A single normalization layer converts many CSV/tab/semicolon formats (and
 * M-Pesa statements) into one transaction shape. Nothing here is tied to a
 * specific bank — column detection is heuristic so new formats work without
 * code changes.
 */

export interface NormalizedTxn {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // signed: + money in, − money out
  reference?: string;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const DMY_RE = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/;

/** Parse an arbitrary date string into YYYY-MM-DD, or null. */
export function toIsoDate(input: string): string | null {
  const s = String(input).trim();
  const iso = s.match(DATE_RE);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(DMY_RE);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function toNumber(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  const negParen = /^\((.*)\)$/.test(s);
  if (negParen) s = s.replace(/^\((.*)\)$/, "$1");
  const negative = negParen || /^-/.test(s);
  s = s.replace(/[^0-9.]/g, "");
  if (!s) return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return negative ? -n : n;
}

/** Split CSV/TSV/semicolon text into rows. Handles quoted fields. */
export function parseDelimited(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const delimiter = detectDelimiter(text);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c.length > 0));
}

function detectDelimiter(text: string): string {
  const sample = text.slice(0, 2000);
  const counts: Record<string, number> = {
    ",": (sample.match(/,/g) || []).length,
    ";": (sample.match(/;/g) || []).length,
    "\t": (sample.match(/\t/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ",";
}

function findHeaderIndex(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const lower = rows[i].map((c) => c.toLowerCase());
    if (lower.some((c) => c.includes("date")) && lower.some((c) => /desc|detail|narrat|particular|reference|transaction/.test(c))) {
      return i;
    }
  }
  return -1;
}

function colIndex(headers: string[], patterns: RegExp[]): number {
  for (const p of patterns) {
    const idx = headers.findIndex((h) => p.test(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Normalize statement rows into transactions.
 * Supports: single Amount column; separate Debit/Credit; Money out/Money in;
 * Withdrawal/Deposit; M-Pesa (Paid In / Withdrawn). Falls back to
 * [date, description, amount] when no header is found.
 */
export function normalizeStatement(rows: string[][]): NormalizedTxn[] {
  if (rows.length === 0) return [];
  const headerIdx = findHeaderIndex(rows);
  const out: NormalizedTxn[] = [];

  if (headerIdx === -1) {
    // Heuristic, headerless: date in col0, description col1, amount/debit/credit later.
    for (const r of rows) {
      const date = toIsoDate(r[0] ?? "");
      if (!date) continue;
      const nums = r.slice(2).map(toNumber).filter((n): n is number => n !== null);
      const amount = nums.length ? nums.reduce((s, n) => s + n, 0) : null;
      if (amount === null) continue;
      out.push({ date, description: r[1] ?? "Bank transaction", amount });
    }
    return out;
  }

  const headers = rows[headerIdx].map((h) => h.toLowerCase());
  const dateCol = colIndex(headers, [/date/, /time/]);
  const descCol = colIndex(headers, [/desc/, /detail/, /narrat/, /particular/, /transaction/, /reference/]);
  const refCol = colIndex(headers, [/reference/, /ref/, /receipt/]);
  const amountCol = colIndex(headers, [/^amount$/, /amount/, /value/]);
  const debitCol = colIndex(headers, [/debit/, /withdrawal/, /money out/, /paid out/, /^out$/]);
  const creditCol = colIndex(headers, [/credit/, /deposit/, /money in/, /paid in/, /^in$/]);

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const date = dateCol >= 0 ? toIsoDate(r[dateCol] ?? "") : null;
    if (!date) continue;
    const description = (descCol >= 0 ? r[descCol] : "") || "Bank transaction";
    let amount: number | null = null;
    if (debitCol >= 0 || creditCol >= 0) {
      const debit = debitCol >= 0 ? toNumber(r[debitCol] ?? "") : null;
      const credit = creditCol >= 0 ? toNumber(r[creditCol] ?? "") : null;
      if (credit != null && credit !== 0) amount = Math.abs(credit);
      else if (debit != null && debit !== 0) amount = -Math.abs(debit);
    } else if (amountCol >= 0) {
      amount = toNumber(r[amountCol] ?? "");
    }
    if (amount === null || amount === 0) continue;
    out.push({
      date,
      description: description.trim(),
      amount,
      reference: refCol >= 0 ? (r[refCol] ?? "").trim() || undefined : undefined,
    });
  }
  return out;
}
