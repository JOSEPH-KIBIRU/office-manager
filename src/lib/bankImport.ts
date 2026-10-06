/**
 * Bank / M-Pesa statement normalization.
 *
 * A single normalization layer converts many CSV/TSV/Excel/PDF statement
 * layouts (including M-Pesa) into one transaction shape. Column detection is
 * heuristic and never tied to a specific bank, and it explicitly avoids using
 * the running Balance column as the transaction amount.
 */

export interface NormalizedTxn {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // signed: + money in, − money out
  reference?: string;
}

export interface NormalizeResult {
  transactions: NormalizedTxn[];
  detected: {
    headerRow: number | null;
    dateCol: number;
    descCol: number;
    mode: "debit_credit" | "single_amount" | "heuristic";
    amountCol?: number;
    debitCol?: number;
    creditCol?: number;
    balanceCol?: number;
  };
}

const DATE_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})/;
const DATE_DMY = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/;
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Parse an arbitrary date string into YYYY-MM-DD, or null. */
export function toIsoDate(input: string): string | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  const iso = s.match(DATE_ISO);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const dmy = s.match(DATE_DMY);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  // "05 Sep 2026" / "5-Sep-2026" / "Sep 5, 2026"
  const mon = s.match(/(\d{1,2})[\s\-/]+([A-Za-z]{3,})[\s\-/,]+(\d{2,4})/);
  if (mon) {
    const m = MONTHS[mon[2].slice(0, 3).toLowerCase()];
    let y = Number(mon[3]);
    if (y < 100) y += 2000;
    if (m) return `${y}-${String(m).padStart(2, "0")}-${String(Number(mon[1])).padStart(2, "0")}`;
  }
  const mon2 = s.match(/([A-Za-z]{3,})[\s\-/]+(\d{1,2})[\s\-/,]+(\d{2,4})/);
  if (mon2) {
    const m = MONTHS[mon2[1].slice(0, 3).toLowerCase()];
    let y = Number(mon2[3]);
    if (y < 100) y += 2000;
    if (m) return `${y}-${String(m).padStart(2, "0")}-${String(Number(mon2[2])).padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function looksLikeDate(s: string): boolean {
  return toIsoDate(s) !== null;
}

/**
 * Parse a money value. Handles 1,234.56 · (1,234.56) · -1234.56 · 1234.56- ·
 * 1.234,56 (EU) · "1,234.56 DR"/"CR". Returns null for non-money text or dates.
 */
export function toNumber(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  if (looksLikeDate(s)) return null;

  let negative = false;
  let toupper = s.toUpperCase();
  if (/\bDR\b/.test(toupper)) negative = true;
  if (/^\((.*)\)$/.test(s)) {
    negative = true;
    s = s.replace(/^\((.*)\)$/, "$1");
  }
  if (/-\s*$/.test(s)) {
    negative = true;
    s = s.replace(/-\s*$/, "");
  }
  if (/^-/.test(s)) {
    negative = true;
    s = s.replace(/^-/, "");
  }
  toupper = s.toUpperCase();
  s = s.replace(/[^0-9.,]/g, "");
  if (!s) return null;

  // Decide decimal separator: if the last separator is a comma with <=2 trailing digits → decimal comma.
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot && s.length - lastComma <= 3) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  // Reject things that don't look like money (e.g. long account numbers with no separator).
  if (!/^\d+(\.\d{1,2})?$/.test(s) && !/^\d+$/.test(s)) {
    // allow whole numbers / 1–2 decimals only
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
  }
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
  const sample = text.slice(0, 4000);
  const counts: Record<string, number> = {
    ",": (sample.match(/,/g) || []).length,
    ";": (sample.match(/;/g) || []).length,
    "\t": (sample.match(/\t/g) || []).length,
    "|": (sample.match(/\|/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ",";
}

function normHeader(h: string): string {
  return String(h ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

const DATE_HDR = [/date/, /completion time/, /value date/, /posting date/, /transaction date/, /time/];
const DESC_HDR = [/description/, /details/, /narrat/, /particular/, /transaction details/, /remarks/, /memo/, /transaction type/];
const REF_HDR = [/reference/, /ref\b/, /receipt/, /cheque/, /transaction id/, /document/];
const BALANCE_HDR = [/balance/, /running/, /available/, /closing/];
const DEBIT_HDR = [/debit/, /withdrawal/, /withdrawn/, /money out/, /paid out/, /cash out/, /^out$/, /^dr$/, /withdrawals/];
const CREDIT_HDR = [/credit/, /deposit/, /money in/, /paid in/, /cash in/, /^in$/, /^cr$/, /deposits/];
const AMOUNT_HDR = [/^amount$/, /amount/, /value/, /kes/, /transaction amount/];

function findHeader(headers: string[], patterns: RegExp[], exclude: Set<number>): number {
  for (const p of patterns) {
    const idx = headers.findIndex((h, i) => !exclude.has(i) && p.test(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

function findHeaderRow(rows: string[][]): number {
  const limit = Math.min(rows.length, 40);
  for (let i = 0; i < limit; i++) {
    const lower = rows[i].map((c) => normHeader(c));
    const hasDate = lower.some((c) => /date|time/.test(c));
    const hasMoney = lower.some((c) =>
      /amount|debit|credit|withdraw|deposit|money in|money out|paid in|paid out|balance/.test(c)
    );
    const hasDesc = lower.some((c) => /desc|detail|narrat|particular|remark|memo|reference/.test(c));
    if (hasDate && hasMoney && (hasDesc || lower.length >= 3)) return i;
  }
  return -1;
}

function pickAmountColumnFromData(rows: string[][], dataStartRow: number, dateCol: number, exclude: Set<number>): number {
  let best = -1;
  let bestScore = 0;
  for (let c = 0; c < (rows[dataStartRow]?.length ?? 0); c++) {
    if (c === dateCol || exclude.has(c)) continue;
    let numeric = 0;
    let total = 0;
    for (let r = dataStartRow; r < rows.length; r++) {
      const v = rows[r][c];
      if (v === undefined) continue;
      total++;
      if (toNumber(v) !== null) numeric++;
    }
    if (total === 0) continue;
    const score = numeric / total;
    if (numeric >= 2 && score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/**
 * Normalize statement rows into transactions, with detected column info.
 * Prefers explicit Debit/Credit columns, then a single Amount column, and
 * always excludes the running Balance column.
 */
export function normalizeStatementDetailed(rows: string[][]): NormalizeResult {
  const detected: NormalizeResult["detected"] = { headerRow: null, dateCol: 0, descCol: 1, mode: "heuristic" };
  if (rows.length === 0) return { transactions: [], detected };

  const headerIdx = findHeaderRow(rows);
  const out: NormalizedTxn[] = [];

  if (headerIdx === -1) {
    // Headerless: find the date column, then the first money column (skip balance).
    let dateCol = 0;
    let bestDates = 0;
    for (let c = 0; c < (rows[0]?.length ?? 0); c++) {
      let n = 0;
      for (const r of rows) if (r[c] && looksLikeDate(r[c])) n++;
      if (n > bestDates) {
        bestDates = n;
        dateCol = c;
      }
    }
    detected.mode = "heuristic";
    detected.dateCol = dateCol;
    const amountCol = pickAmountColumnFromData(rows, 0, dateCol, new Set());
    detected.amountCol = amountCol >= 0 ? amountCol : undefined;
    const descCol = dateCol === 0 ? 1 : 0;
    detected.descCol = descCol;
    for (const r of rows) {
      const date = toIsoDate(r[dateCol] ?? "");
      if (!date) continue;
      const amount = amountCol >= 0 ? toNumber(r[amountCol] ?? "") : null;
      if (amount === null || amount === 0) continue;
      out.push({ date, description: (r[descCol] ?? "Bank transaction").trim() || "Bank transaction", amount });
    }
    return { transactions: out, detected };
  }

  const header = rows[headerIdx].map((h) => normHeader(h));
  const used = new Set<number>();
  const dateCol = findHeader(header, DATE_HDR, used);
  if (dateCol >= 0) used.add(dateCol);
  const descCol = findHeader(header, DESC_HDR, used);
  if (descCol >= 0) used.add(descCol);
  const refCol = findHeader(header, REF_HDR, used);
  if (refCol >= 0) used.add(refCol);
  const balanceCol = findHeader(header, BALANCE_HDR, used);
  if (balanceCol >= 0) used.add(balanceCol);
  const debitCol = findHeader(header, DEBIT_HDR, used);
  if (debitCol >= 0) used.add(debitCol);
  const creditCol = findHeader(header, CREDIT_HDR, used);
  if (creditCol >= 0) used.add(creditCol);
  // Amount column only if we don't already have debit/credit, and never the balance.
  let amountCol = -1;
  if (debitCol === -1 && creditCol === -1) {
    amountCol = findHeader(header, AMOUNT_HDR, used);
    if (amountCol >= 0) used.add(amountCol);
  }

  detected.headerRow = headerIdx;
  detected.dateCol = dateCol >= 0 ? dateCol : 0;
  detected.descCol = descCol >= 0 ? descCol : 1;
  detected.balanceCol = balanceCol >= 0 ? balanceCol : undefined;

  const dataRows = rows.slice(headerIdx + 1);

  if (dateCol === -1) {
    // Header found but no date column; fall back to heuristic on data rows.
    return normalizeStatementDetailed(dataRows);
  }

  if (debitCol >= 0 || creditCol >= 0) {
    detected.mode = "debit_credit";
    detected.debitCol = debitCol >= 0 ? debitCol : undefined;
    detected.creditCol = creditCol >= 0 ? creditCol : undefined;
    for (const r of dataRows) {
      const date = toIsoDate(r[dateCol] ?? "");
      if (!date) continue;
      const debit = debitCol >= 0 ? toNumber(r[debitCol] ?? "") : null;
      const credit = creditCol >= 0 ? toNumber(r[creditCol] ?? "") : null;
      let amount: number | null = null;
      if (credit != null && credit !== 0) amount = Math.abs(credit);
      else if (debit != null && debit !== 0) amount = -Math.abs(debit);
      if (amount === null || amount === 0) continue;
      out.push({
        date,
        description: (descCol >= 0 ? r[descCol] : "") || "Bank transaction",
        amount,
        reference: refCol >= 0 ? (r[refCol] ?? "").trim() || undefined : undefined,
      });
    }
    return { transactions: out, detected };
  }

  if (amountCol >= 0) {
    detected.mode = "single_amount";
    detected.amountCol = amountCol;
    for (const r of dataRows) {
      const date = toIsoDate(r[dateCol] ?? "");
      if (!date) continue;
      const amount = toNumber(r[amountCol] ?? "");
      if (amount === null || amount === 0) continue;
      out.push({
        date,
        description: (descCol >= 0 ? r[descCol] : "") || "Bank transaction",
        amount,
        reference: refCol >= 0 ? (r[refCol] ?? "").trim() || undefined : undefined,
      });
    }
    return { transactions: out, detected };
  }

  // Header exists but no recognisable money column: pick from the data.
  const picked = pickAmountColumnFromData(rows, headerIdx + 1, dateCol, used);
  detected.mode = "heuristic";
  detected.amountCol = picked >= 0 ? picked : undefined;
  if (picked >= 0) {
    for (const r of dataRows) {
      const date = toIsoDate(r[dateCol] ?? "");
      if (!date) continue;
      const amount = toNumber(r[picked] ?? "");
      if (amount === null || amount === 0) continue;
      out.push({
        date,
        description: (descCol >= 0 ? r[descCol] : "") || "Bank transaction",
        amount,
        reference: refCol >= 0 ? (r[refCol] ?? "").trim() || undefined : undefined,
      });
    }
  }
  return { transactions: out, detected };
}

export function normalizeStatement(rows: string[][]): NormalizedTxn[] {
  return normalizeStatementDetailed(rows).transactions;
}
