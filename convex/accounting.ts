import { query, mutation, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { assertSecret, tsNow } from "./lib";

/* ------------------------------------------------------------------ *
 * Chart of accounts (Kenya SME, generic). Seeded per organization.
 * ------------------------------------------------------------------ */

type AccountType = "asset" | "liability" | "equity" | "income" | "cost_of_sales" | "expense";

type AccountControl =
  | "ar"
  | "ap"
  | "bank"
  | "cash"
  | "vat_input"
  | "vat_output"
  | "retained_earnings"
  | "suspense";

type SeedAccount = {
  code: string;
  name: string;
  type: AccountType;
  group: string;
  parentCode?: string;
  category?: "current" | "non_current";
  control?: AccountControl;
  taxTreatment?: string;
  isCash?: boolean;
  isVat?: boolean;
  statutory?: boolean;
};

export const DEFAULT_CHART: SeedAccount[] = [
  { code: "1000", name: "Cash on hand", type: "asset", group: "Current assets", category: "current", isCash: true, control: "cash" },
  { code: "1010", name: "Petty cash", type: "asset", group: "Current assets", category: "current", isCash: true },
  { code: "1020", name: "Bank", type: "asset", group: "Current assets", category: "current", isCash: true, control: "bank" },
  { code: "1030", name: "M-Pesa", type: "asset", group: "Current assets", category: "current", isCash: true },
  { code: "1090", name: "Suspense (clearing)", type: "asset", group: "Current assets", category: "current", control: "suspense" },
  { code: "1100", name: "Accounts receivable", type: "asset", group: "Current assets", category: "current", control: "ar" },
  { code: "1150", name: "VAT input (recoverable)", type: "asset", group: "Current assets", category: "current", isVat: true, taxTreatment: "vat_16" },
  { code: "1200", name: "Motor vehicles", type: "asset", group: "Non-current assets", category: "non_current" },
  { code: "1210", name: "Furniture and fittings", type: "asset", group: "Non-current assets", category: "non_current" },
  { code: "2000", name: "Accounts payable", type: "liability", group: "Current liabilities", category: "current", control: "ap" },
  { code: "2100", name: "PAYE payable", type: "liability", group: "Statutory", category: "current", statutory: true },
  { code: "2110", name: "NSSF payable", type: "liability", group: "Statutory", category: "current", statutory: true },
  { code: "2120", name: "SHIF payable", type: "liability", group: "Statutory", category: "current", statutory: true },
  { code: "2130", name: "Housing levy payable", type: "liability", group: "Statutory", category: "current", statutory: true },
  { code: "2150", name: "VAT output", type: "liability", group: "Statutory", category: "current", isVat: true, taxTreatment: "vat_16", statutory: true, control: "vat_output" },
  { code: "2160", name: "HELB payable", type: "liability", group: "Statutory", category: "current", statutory: true },
  { code: "2170", name: "Pension payable", type: "liability", group: "Statutory", category: "current", statutory: true },
  { code: "2180", name: "Staff loans & advances payable", type: "liability", group: "People", category: "current" },
  { code: "2190", name: "Other payroll deductions payable", type: "liability", group: "People", category: "current" },
  { code: "3000", name: "Share capital", type: "equity", group: "Equity" },
  { code: "3100", name: "Retained earnings", type: "equity", group: "Equity", control: "retained_earnings" },
  { code: "4000", name: "Sales and services", type: "income", group: "Revenue", taxTreatment: "vat_16" },
  { code: "4100", name: "Other income", type: "income", group: "Other income" },
  { code: "4600", name: "Cost of sales", type: "cost_of_sales", group: "Cost of sales", parentCode: undefined },
  { code: "4610", name: "Direct materials", type: "cost_of_sales", group: "Cost of sales", parentCode: "4600" },
  { code: "4620", name: "Direct labour", type: "cost_of_sales", group: "Cost of sales", parentCode: "4600" },
  { code: "4630", name: "Production overheads", type: "cost_of_sales", group: "Cost of sales", parentCode: "4600" },
  { code: "5000", name: "Salaries and wages", type: "expense", group: "People" },
  { code: "5010", name: "Employer NSSF", type: "expense", group: "People" },
  { code: "5020", name: "Employer SHIF", type: "expense", group: "People" },
  { code: "5030", name: "Employer housing levy", type: "expense", group: "People" },
  { code: "5100", name: "Fuel and mileage", type: "expense", group: "Fleet" },
  { code: "5110", name: "Vehicle repairs and servicing", type: "expense", group: "Fleet" },
  { code: "5120", name: "Insurance", type: "expense", group: "Fleet" },
  { code: "5200", name: "Rent", type: "expense", group: "Operating expenses" },
  { code: "5210", name: "Utilities and airtime", type: "expense", group: "Operating expenses" },
  { code: "5220", name: "Stationery", type: "expense", group: "Operating expenses" },
  { code: "5230", name: "Staff welfare", type: "expense", group: "Operating expenses" },
  { code: "5300", name: "Depreciation", type: "expense", group: "Non-cash" },
  { code: "5400", name: "Bank charges", type: "expense", group: "Finance" },
  { code: "5500", name: "Professional fees", type: "expense", group: "Operating expenses" },
  { code: "5990", name: "General expenses", type: "expense", group: "Operating expenses" },
];

const DEFAULT_CONTROL_CODES: Record<AccountControl, string> = {
  ar: "1100",
  ap: "2000",
  bank: "1020",
  cash: "1000",
  vat_input: "1150",
  vat_output: "2150",
  retained_earnings: "3100",
  suspense: "1090",
};

/**
 * Resolve the ledger account code for a control role (AR, AP, bank, tax…).
 * Prefers an account explicitly flagged with `control`, falling back to the
 * seeded default code so existing postings keep working unchanged.
 */
export async function resolveControlCode(
  ctx: MutationCtx | QueryCtx,
  orgId: Id<"organizations">,
  control: AccountControl
): Promise<string> {
  const rows = await ctx.db.query("ledgerAccounts").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  const flagged = rows.find((a) => a.control === control && a.active);
  return flagged?.code ?? DEFAULT_CONTROL_CODES[control];
}

/** Resolve the cash/bank account a receipt/payment settles into. */
export async function resolveCashAccount(
  ctx: MutationCtx | QueryCtx,
  orgId: Id<"organizations">,
  method: "bank" | "mpesa" | "cash"
): Promise<string> {
  if (method === "bank") return resolveControlCode(ctx, orgId, "bank");
  if (method === "cash") return resolveControlCode(ctx, orgId, "cash");
  // M-Pesa: prefer an account named/flagged M-Pesa, else fall back to 1030.
  const rows = await ctx.db.query("ledgerAccounts").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  const mpesa = rows.find((a) => a.isCash && /m-?pesa/i.test(a.name) && a.active);
  return mpesa?.code ?? "1030";
}

/* ------------------------------------------------------------------ *
 * Pure helpers (no ctx)
 * ------------------------------------------------------------------ */

export function roundKes(n: number): number {
  return Math.round(n);
}

export function periodOf(date: string): string {
  return date.slice(0, 7);
}

export function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, 1));
  return new Intl.DateTimeFormat("en-KE", { month: "long", year: "numeric", timeZone: "UTC" }).format(dt);
}

function periodBounds(period: string): { start: string; end: string } {
  const [y, m] = period.split("-").map(Number);
  const start = `${period}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start, end: `${period}-${String(lastDay).padStart(2, "0")}` };
}

function isDebitNormal(type: AccountType): boolean {
  return type === "asset" || type === "expense" || type === "cost_of_sales";
}

export type JournalLine = { accountCode: string; debit: number; credit: number; memo?: string };

export function assertBalancedLines(lines: JournalLine[]): void {
  if (lines.length < 2) throw new Error("A journal needs at least two lines.");
  let dr = 0;
  let cr = 0;
  for (const l of lines) {
    if (l.debit < 0 || l.credit < 0) throw new Error("Debits and credits cannot be negative.");
    if (l.debit > 0 && l.credit > 0) throw new Error(`Account ${l.accountCode} has both a debit and a credit.`);
    if (l.debit === 0 && l.credit === 0) throw new Error(`Account ${l.accountCode} is empty.`);
    dr += l.debit;
    cr += l.credit;
  }
  if (roundKes(dr) !== roundKes(cr)) {
    throw new Error(
      `Journal is out of balance by KES ${Math.abs(dr - cr).toLocaleString("en-KE")} (Dr ${dr.toLocaleString("en-KE")} / Cr ${cr.toLocaleString("en-KE")}).`
    );
  }
}

/* ------------------------------------------------------------------ *
 * Context helpers
 * ------------------------------------------------------------------ */

async function ensureChartInternal(ctx: MutationCtx, orgId: Id<"organizations">): Promise<void> {
  const existing = await ctx.db.query("ledgerAccounts").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  const have = new Map(existing.map((a) => [a.code, a]));
  const now = tsNow();
  // Seed the full chart for a new org; for existing orgs, backfill any newly
  // introduced default accounts so newer postings don't fail.
  for (const a of DEFAULT_CHART) {
    if (have.has(a.code)) {
      // Backfill control/classification metadata without touching codes, names
      // or types of existing accounts (backward compatibility).
      const doc = have.get(a.code)!;
      if (doc.builtIn === undefined) {
        await ctx.db.patch(doc._id, {
          builtIn: true,
          ...(doc.control === undefined && a.control ? { control: a.control } : {}),
          ...(doc.category === undefined && a.category ? { category: a.category } : {}),
          ...(doc.parentCode === undefined && a.parentCode ? { parentCode: a.parentCode } : {}),
          ...(doc.taxTreatment === undefined && a.taxTreatment ? { taxTreatment: a.taxTreatment } : {}),
        });
      }
      continue;
    }
    await ctx.db.insert("ledgerAccounts", {
      orgId,
      code: a.code,
      name: a.name,
      type: a.type,
      group: a.group,
      parentCode: a.parentCode,
      category: a.category,
      control: a.control,
      taxTreatment: a.taxTreatment,
      isCash: a.isCash,
      isVat: a.isVat,
      statutory: a.statutory,
      builtIn: true,
      active: true,
      createdAt: now,
    });
  }
}

async function ensurePeriodInternal(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  date: string
): Promise<{ period: string; status: "open" | "locked" | "future" }> {
  const period = periodOf(date);
  const existing = await ctx.db
    .query("accountingPeriods")
    .withIndex("by_org_period", (q) => q.eq("orgId", orgId).eq("period", period))
    .first();
  if (existing) return { period, status: existing.status };
  const { start, end } = periodBounds(period);
  await ctx.db.insert("accountingPeriods", {
    orgId,
    period,
    label: monthLabel(period),
    start,
    end,
    status: "open",
    createdAt: tsNow(),
  });
  return { period, status: "open" };
}

/* ------------------------------------------------------------------ *
 * Posting (used internally + by other modules for auto-post)
 * ------------------------------------------------------------------ */

export type PostSource =
  | "opening"
  | "invoice"
  | "bill"
  | "receipt"
  | "payment"
  | "credit_note"
  | "payroll"
  | "petty_cash"
  | "petty_cash_fund"
  | "car_log"
  | "bank"
  | "vat"
  | "depreciation"
  | "manual";

export interface PostJournalInput {
  orgId: Id<"organizations">;
  source: PostSource;
  sourceId?: string;
  date: string;
  description: string;
  lines: JournalLine[];
  postedBy?: Id<"users">;
  postedByName?: string;
}

/** Post a balanced journal for a source document. Idempotent per (source, sourceId). */
export async function postJournalForSource(ctx: MutationCtx, input: PostJournalInput): Promise<Id<"journals">> {
  await ensureChartInternal(ctx, input.orgId);
  const { period, status } = await ensurePeriodInternal(ctx, input.orgId, input.date);
  if (status === "locked") throw new Error(`${monthLabel(period)} is locked — cannot post.`);

  if (input.sourceId) {
    const existing = await ctx.db
      .query("journals")
      .withIndex("by_source", (q) =>
        q.eq("orgId", input.orgId).eq("source", input.source).eq("sourceId", input.sourceId as never)
      )
      .first();
    // Treat a reversed entry as "not posted" so a correction can re-post.
    if (existing && !existing.reversedBy) return existing._id;
  }

  const lines = input.lines
    .map((l) => ({
      accountCode: l.accountCode,
      debit: roundKes(l.debit),
      credit: roundKes(l.credit),
      memo: l.memo,
    }))
    .filter((l) => l.debit !== 0 || l.credit !== 0);
  assertBalancedLines(lines);

  const accounts = await ctx.db.query("ledgerAccounts").withIndex("by_org", (q) => q.eq("orgId", input.orgId)).collect();
  const known = new Set(accounts.map((a) => a.code));
  for (const l of lines) {
    if (!known.has(l.accountCode)) throw new Error(`Unknown ledger account ${l.accountCode}.`);
  }

  const count = (await ctx.db.query("journals").withIndex("by_org", (q) => q.eq("orgId", input.orgId)).collect()).length;
  const now = tsNow();
  return ctx.db.insert("journals", {
    orgId: input.orgId,
    date: input.date,
    period,
    ref: `JNL-${String(count + 1).padStart(4, "0")}`,
    source: input.source,
    sourceId: input.sourceId,
    description: input.description,
    lines,
    postedBy: input.postedBy,
    postedByName: input.postedByName,
    postedAt: now,
    createdAt: now,
  });
}

/** Best-effort variant for auto-posting from approvals — never breaks the caller. */
export async function tryPostJournalForSource(ctx: MutationCtx, input: PostJournalInput): Promise<void> {
  try {
    await postJournalForSource(ctx, input);
  } catch (e) {
    console.log("[accounting] auto-post skipped:", e instanceof Error ? e.message : String(e));
  }
}

/** Reverse a journal with a reversing entry. Returns null when not applicable. */
export async function reverseJournalInternal(
  ctx: MutationCtx,
  opts: { orgId: Id<"organizations">; journalId: Id<"journals">; date: string; postedBy?: Id<"users">; postedByName?: string }
): Promise<Id<"journals"> | null> {
  const original = await ctx.db.get(opts.journalId);
  if (!original || original.orgId !== opts.orgId) return null;
  if (original.reversedBy) return null;
  const { status } = await ensurePeriodInternal(ctx, opts.orgId, opts.date);
  if (status === "locked") return null;
  const count = (await ctx.db.query("journals").withIndex("by_org", (q) => q.eq("orgId", opts.orgId)).collect()).length;
  const now = tsNow();
  const revId = await ctx.db.insert("journals", {
    orgId: opts.orgId,
    date: opts.date,
    period: periodOf(opts.date),
    ref: `REV-${String(count + 1).padStart(4, "0")}`,
    source: "manual",
    sourceId: original.sourceId,
    description: `Reversal of ${original.ref} — ${original.description}`,
    lines: original.lines.map((l) => ({ accountCode: l.accountCode, debit: l.credit, credit: l.debit, memo: l.memo })),
    postedBy: opts.postedBy,
    postedByName: opts.postedByName,
    postedAt: now,
    reversesId: original._id,
    createdAt: now,
  });
  await ctx.db.patch(original._id, { reversedBy: revId });
  return revId;
}

/* ------------------------------------------------------------------ *
 * Reporting (pure over journals + account map)
 * ------------------------------------------------------------------ */

type JournalLike = { date: string; lines: JournalLine[]; reversedBy?: unknown };

/**
 * Reports include every posted journal — including a reversed original AND its
 * reversing entry — so a voided document nets to zero while the full audit
 * trail stays visible.
 */
function activityByAccount(journals: JournalLike[], opts?: { from?: string; through?: string }) {
  const map = new Map<string, { debit: number; credit: number }>();
  for (const j of journals) {
    if (opts?.through && j.date > opts.through) continue;
    if (opts?.from && j.date < opts.from) continue;
    for (const line of j.lines) {
      const cur = map.get(line.accountCode) ?? { debit: 0, credit: 0 };
      cur.debit += line.debit;
      cur.credit += line.credit;
      map.set(line.accountCode, cur);
    }
  }
  return map;
}

type AccountMap = Map<string, { name: string; type: AccountType; group: string; isCash?: boolean; isVat?: boolean }>;

function signed(type: AccountType, debit: number, credit: number): number {
  return isDebitNormal(type) ? debit - credit : credit - debit;
}

async function loadAccounts(ctx: QueryCtx, orgId: Id<"organizations">): Promise<AccountMap> {
  const rows = await ctx.db.query("ledgerAccounts").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  return new Map(
    rows.map((a) => [a.code, { name: a.name, type: a.type as AccountType, group: a.group, isCash: a.isCash, isVat: a.isVat }])
  );
}

async function loadJournals(ctx: QueryCtx, orgId: Id<"organizations">) {
  return ctx.db.query("journals").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
}

function rowsOfType(
  journals: JournalLike[],
  accounts: AccountMap,
  type: AccountType,
  opts: { from?: string; through?: string }
) {
  const act = activityByAccount(journals, opts);
  const rows: Array<{ code: string; name: string; amount: number; group: string }> = [];
  for (const [code, a] of accounts) {
    if (a.type !== type) continue;
    const { debit, credit } = act.get(code) ?? { debit: 0, credit: 0 };
    const amount = signed(type, debit, credit);
    if (roundKes(amount) === 0) continue;
    rows.push({ code, name: a.name, amount: roundKes(amount), group: a.group });
  }
  rows.sort((x, y) => x.code.localeCompare(y.code));
  return rows;
}

/* ------------------------------------------------------------------ *
 * Convex functions
 * ------------------------------------------------------------------ */

export const ensure = mutation({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await ensureChartInternal(ctx, args.orgId);
    const year = new Date().getFullYear();
    for (let m = 1; m <= 12; m++) {
      const period = `${year}-${String(m).padStart(2, "0")}`;
      const existing = await ctx.db
        .query("accountingPeriods")
        .withIndex("by_org_period", (q) => q.eq("orgId", args.orgId).eq("period", period))
        .first();
      if (!existing) {
        const { start, end } = periodBounds(period);
        await ctx.db.insert("accountingPeriods", {
          orgId: args.orgId,
          period,
          label: monthLabel(period),
          start,
          end,
          status: "open",
          createdAt: tsNow(),
        });
      }
    }
    return true;
  },
});

/* ------------------------------------------------------------------ *
 * Chart of accounts: configurable, hierarchical, backward compatible
 * ------------------------------------------------------------------ */

const ACCOUNT_TYPES: AccountType[] = ["asset", "liability", "equity", "income", "cost_of_sales", "expense"];

async function journalActivity(ctx: MutationCtx | QueryCtx, orgId: Id<"organizations">) {
  const journals = await ctx.db.query("journals").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  const map = new Map<string, { debit: number; credit: number }>();
  for (const j of journals) for (const l of j.lines) {
    const cur = map.get(l.accountCode) ?? { debit: 0, credit: 0 };
    cur.debit += l.debit;
    cur.credit += l.credit;
    map.set(l.accountCode, cur);
  }
  return map;
}

/** Full chart with balances, hierarchy and usage flags (for the CoA screen). */
export const listChart = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("ledgerAccounts").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const act = await journalActivity(ctx, args.orgId);
    const hasChildren = new Set(rows.map((a) => a.parentCode).filter(Boolean) as string[]);
    return rows
      .map((a) => {
        const { debit, credit } = act.get(a.code) ?? { debit: 0, credit: 0 };
        return {
          code: a.code,
          name: a.name,
          type: a.type,
          group: a.group,
          parentCode: a.parentCode ?? null,
          category: a.category ?? null,
          control: a.control ?? null,
          taxTreatment: a.taxTreatment ?? null,
          description: a.description ?? null,
          isCash: a.isCash ?? false,
          isVat: a.isVat ?? false,
          statutory: a.statutory ?? false,
          builtIn: a.builtIn ?? false,
          active: a.active,
          balance: roundKes(signed(a.type as AccountType, debit, credit)),
          hasTransactions: debit !== 0 || credit !== 0,
          hasChildren: hasChildren.has(a.code),
        };
      })
      .sort((x, y) => x.code.localeCompare(y.code));
  },
});

export const createAccount = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    code: v.string(),
    name: v.string(),
    type: v.string(),
    group: v.string(),
    parentCode: v.optional(v.string()),
    category: v.optional(v.string()),
    control: v.optional(v.string()),
    taxTreatment: v.optional(v.string()),
    description: v.optional(v.string()),
    isCash: v.optional(v.boolean()),
    isVat: v.optional(v.boolean()),
    statutory: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const code = args.code.trim();
    const name = args.name.trim();
    if (!code) throw new Error("An account code is required");
    if (!name) throw new Error("An account name is required");
    if (!ACCOUNT_TYPES.includes(args.type as AccountType)) throw new Error("Invalid account type");
    const existing = await ctx.db
      .query("ledgerAccounts")
      .withIndex("by_org_code", (q) => q.eq("orgId", args.orgId).eq("code", code))
      .first();
    if (existing) throw new Error(`Account ${code} already exists`);
    const now = tsNow();
    await ctx.db.insert("ledgerAccounts", {
      orgId: args.orgId,
      code,
      name,
      type: args.type as AccountType,
      group: args.group.trim() || "Other",
      parentCode: args.parentCode?.trim() || undefined,
      category: (args.category as "current" | "non_current") || undefined,
      control: (args.control as AccountControl) || undefined,
      taxTreatment: args.taxTreatment?.trim() || undefined,
      description: args.description?.trim() || undefined,
      isCash: args.isCash,
      isVat: args.isVat,
      statutory: args.statutory,
      builtIn: false,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    return { code };
  },
});

export const updateAccount = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    code: v.string(),
    newCode: v.optional(v.string()),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    group: v.optional(v.string()),
    parentCode: v.optional(v.string()),
    category: v.optional(v.string()),
    control: v.optional(v.string()),
    taxTreatment: v.optional(v.string()),
    description: v.optional(v.string()),
    isCash: v.optional(v.boolean()),
    isVat: v.optional(v.boolean()),
    statutory: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db
      .query("ledgerAccounts")
      .withIndex("by_org_code", (q) => q.eq("orgId", args.orgId).eq("code", args.code))
      .first();
    if (!doc) throw new Error("Account not found");

    const patch: Record<string, unknown> = { updatedAt: tsNow() };

    // Changing the code is only "safe" when the account has no journal activity.
    if (args.newCode !== undefined && args.newCode.trim() && args.newCode.trim() !== doc.code) {
      const newCode = args.newCode.trim();
      const act = await journalActivity(ctx, args.orgId);
      if (act.has(doc.code)) {
        throw new Error("This account has posted transactions — its code cannot be changed. Rename it instead.");
      }
      const clash = await ctx.db
        .query("ledgerAccounts")
        .withIndex("by_org_code", (q) => q.eq("orgId", args.orgId).eq("code", newCode))
        .first();
      if (clash) throw new Error(`Account ${newCode} already exists`);
      patch.code = newCode;
      // Re-point any subaccounts to the new parent code.
      const children = await ctx.db.query("ledgerAccounts").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
      for (const c of children) {
        if (c.parentCode === doc.code) await ctx.db.patch(c._id, { parentCode: newCode });
      }
    }

    if (args.name !== undefined) {
      if (!args.name.trim()) throw new Error("Account name is required");
      patch.name = args.name.trim();
    }
    if (args.type !== undefined) {
      if (!ACCOUNT_TYPES.includes(args.type as AccountType)) throw new Error("Invalid account type");
      patch.type = args.type;
    }
    if (args.group !== undefined) patch.group = args.group.trim() || "Other";
    if (args.parentCode !== undefined) patch.parentCode = args.parentCode.trim() || undefined;
    if (args.category !== undefined) patch.category = (args.category as "current" | "non_current") || undefined;
    if (args.control !== undefined) patch.control = (args.control as AccountControl) || undefined;
    if (args.taxTreatment !== undefined) patch.taxTreatment = args.taxTreatment.trim() || undefined;
    if (args.description !== undefined) patch.description = args.description.trim() || undefined;
    if (args.isCash !== undefined) patch.isCash = args.isCash;
    if (args.isVat !== undefined) patch.isVat = args.isVat;
    if (args.statutory !== undefined) patch.statutory = args.statutory;

    await ctx.db.patch(doc._id, patch);
    return { code: (patch.code as string) ?? doc.code };
  },
});

/** Deactivate/reactivate an account (archive). Accounts are never hard-deleted. */
export const setAccountActive = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), code: v.string(), active: v.boolean() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db
      .query("ledgerAccounts")
      .withIndex("by_org_code", (q) => q.eq("orgId", args.orgId).eq("code", args.code))
      .first();
    if (!doc) throw new Error("Account not found");
    await ctx.db.patch(doc._id, { active: args.active, updatedAt: tsNow() });
    return true;
  },
});

export const overview = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const accounts = await loadAccounts(ctx, args.orgId);
    const journals = await loadJournals(ctx, args.orgId);
    const act = activityByAccount(journals);
    const balances = [...accounts.entries()]
      .map(([code, a]) => ({
        code,
        name: a.name,
        type: a.type,
        group: a.group,
        isCash: a.isCash ?? false,
        balance: roundKes(signed(a.type, act.get(code)?.debit ?? 0, act.get(code)?.credit ?? 0)),
      }))
      .sort((x, y) => x.code.localeCompare(y.code));

    const cashCodes = [...accounts.entries()].filter(([, a]) => a.isCash);
    const cashParts = cashCodes.map(([code, a]) => ({
      code,
      name: a.name,
      balance: roundKes(signed(a.type, act.get(code)?.debit ?? 0, act.get(code)?.credit ?? 0)),
    }));

    const periods = await ctx.db
      .query("accountingPeriods")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    periods.sort((a, b) => b.period.localeCompare(a.period));

    const posted = journals;
    let dr = 0;
    let cr = 0;
    for (const j of posted) for (const l of j.lines) { dr += l.debit; cr += l.credit; }

    return {
      accounts: balances,
      cash: { parts: cashParts, total: roundKes(cashParts.reduce((s, p) => s + p.balance, 0)) },
      periods: periods.map((p) => ({ period: p.period, label: p.label, status: p.status, lockedAt: p.lockedAt ?? null })),
      journalCount: journals.length,
      trialBalanced: roundKes(dr) === roundKes(cr),
      debitTotal: roundKes(dr),
      creditTotal: roundKes(cr),
    };
  },
});

export const ledger = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    from: v.optional(v.string()),
    through: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const accounts = await loadAccounts(ctx, args.orgId);
    const journals = await loadJournals(ctx, args.orgId);
    const filtered = journals
      .filter((j) => (!args.from || j.date >= args.from) && (!args.through || j.date <= args.through))
      .sort((a, b) => (a.date === b.date ? b.postedAt - a.postedAt : b.date.localeCompare(a.date)));
    return filtered.map((j) => ({
      id: j._id,
      date: j.date,
      period: j.period,
      ref: j.ref,
      source: j.source,
      sourceId: j.sourceId ?? null,
      description: j.description,
      postedByName: j.postedByName ?? null,
      reversed: Boolean(j.reversedBy),
      reversesId: j.reversesId ?? null,
      lines: j.lines.map((l) => ({
        accountCode: l.accountCode,
        accountName: accounts.get(l.accountCode)?.name ?? l.accountCode,
        debit: l.debit,
        credit: l.credit,
        memo: l.memo ?? null,
      })),
    }));
  },
});

export const trialBalance = query({
  args: { secret: v.string(), orgId: v.id("organizations"), through: v.optional(v.string()) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const accounts = await loadAccounts(ctx, args.orgId);
    const journals = await loadJournals(ctx, args.orgId);
    const act = activityByAccount(journals, { through: args.through });
    const rows: Array<{ code: string; name: string; debit: number; credit: number }> = [];
    let debitTotal = 0;
    let creditTotal = 0;
    for (const [code, { debit, credit }] of act) {
      const raw = roundKes(debit - credit);
      if (raw === 0) continue;
      const row = {
        code,
        name: accounts.get(code)?.name ?? code,
        debit: raw > 0 ? raw : 0,
        credit: raw < 0 ? -raw : 0,
      };
      rows.push(row);
      debitTotal += row.debit;
      creditTotal += row.credit;
    }
    rows.sort((a, b) => a.code.localeCompare(b.code));
    return { rows, debitTotal: roundKes(debitTotal), creditTotal: roundKes(creditTotal), balanced: roundKes(debitTotal) === roundKes(creditTotal) };
  },
});

export const profitAndLoss = query({
  args: { secret: v.string(), orgId: v.id("organizations"), from: v.string(), through: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const accounts = await loadAccounts(ctx, args.orgId);
    const journals = await loadJournals(ctx, args.orgId);
    const income = rowsOfType(journals, accounts, "income", { from: args.from, through: args.through });
    const costOfSales = rowsOfType(journals, accounts, "cost_of_sales", { from: args.from, through: args.through });
    const expense = rowsOfType(journals, accounts, "expense", { from: args.from, through: args.through });
    const incomeTotal = roundKes(income.reduce((s, r) => s + r.amount, 0));
    const costOfSalesTotal = roundKes(costOfSales.reduce((s, r) => s + r.amount, 0));
    const expenseTotal = roundKes(expense.reduce((s, r) => s + r.amount, 0));
    const grossProfit = roundKes(incomeTotal - costOfSalesTotal);
    return {
      from: args.from,
      through: args.through,
      income,
      costOfSales,
      expense,
      incomeTotal,
      costOfSalesTotal,
      grossProfit,
      expenseTotal,
      profit: roundKes(grossProfit - expenseTotal),
    };
  },
});

export const balanceSheet = query({
  args: { secret: v.string(), orgId: v.id("organizations"), through: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const accounts = await loadAccounts(ctx, args.orgId);
    const journals = await loadJournals(ctx, args.orgId);
    const yearStart = `${args.through.slice(0, 4)}-01-01`;
    const income = rowsOfType(journals, accounts, "income", { from: yearStart, through: args.through });
    const expense = rowsOfType(journals, accounts, "expense", { from: yearStart, through: args.through });
    const currentYear = roundKes(
      income.reduce((s, r) => s + r.amount, 0) - expense.reduce((s, r) => s + r.amount, 0)
    );
    const assets = rowsOfType(journals, accounts, "asset", { through: args.through });
    const liabilities = rowsOfType(journals, accounts, "liability", { through: args.through });
    const equity = rowsOfType(journals, accounts, "equity", { through: args.through });
    const assetTotal = roundKes(assets.reduce((s, r) => s + r.amount, 0));
    const liabTotal = roundKes(liabilities.reduce((s, r) => s + r.amount, 0));
    const equityPosted = roundKes(equity.reduce((s, r) => s + r.amount, 0));
    const equityTotal = roundKes(equityPosted + currentYear);
    return {
      through: args.through,
      assets,
      liabilities,
      equity,
      currentYear,
      assetTotal,
      liabTotal,
      equityTotal,
      balanced: assetTotal === liabTotal + equityTotal,
    };
  },
});

export const postManual = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    date: v.string(),
    description: v.string(),
    lines: v.array(v.object({ accountCode: v.string(), debit: v.number(), credit: v.number(), memo: v.optional(v.string()) })),
    postedBy: v.optional(v.id("users")),
    postedByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error("A valid date is required");
    if (!args.description.trim()) throw new Error("A description is required");
    return postJournalForSource(ctx, {
      orgId: args.orgId,
      source: "manual",
      date: args.date,
      description: args.description.trim(),
      lines: args.lines,
      postedBy: args.postedBy,
      postedByName: args.postedByName,
    });
  },
});

export const reverseJournal = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    journalId: v.id("journals"),
    date: v.string(),
    postedBy: v.optional(v.id("users")),
    postedByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const original = await ctx.db.get(args.journalId);
    if (!original || original.orgId !== args.orgId) throw new Error("Journal not found");
    if (original.reversedBy) throw new Error("Already reversed");
    const revId = await reverseJournalInternal(ctx, {
      orgId: args.orgId,
      journalId: args.journalId,
      date: args.date,
      postedBy: args.postedBy,
      postedByName: args.postedByName,
    });
    if (!revId) throw new Error("That period is locked — reverse in an open period.");
    return revId;
  },
});

export const lockPeriod = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), period: v.string(), lockedBy: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const row = await ctx.db
      .query("accountingPeriods")
      .withIndex("by_org_period", (q) => q.eq("orgId", args.orgId).eq("period", args.period))
      .first();
    if (!row) throw new Error("Period not found");
    await ctx.db.patch(row._id, { status: "locked", lockedAt: new Date().toISOString().slice(0, 10), lockedBy: args.lockedBy });
    return true;
  },
});

export const unlockPeriod = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), period: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const row = await ctx.db
      .query("accountingPeriods")
      .withIndex("by_org_period", (q) => q.eq("orgId", args.orgId).eq("period", args.period))
      .first();
    if (!row) throw new Error("Period not found");
    await ctx.db.patch(row._id, { status: "open", lockedAt: undefined, lockedBy: undefined });
    return true;
  },
});

/* ------------------------------------------------------------------ *
 * Bank & M-Pesa reconciliation
 * ------------------------------------------------------------------ */

async function assertCashAccount(ctx: MutationCtx, orgId: Id<"organizations">, code: string) {
  const acct = await ctx.db
    .query("ledgerAccounts")
    .withIndex("by_org_code", (q) => q.eq("orgId", orgId).eq("code", code))
    .first();
  if (!acct || !acct.isCash) throw new Error("That is not a cash/bank account.");
  return acct;
}

export const importBankLines = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    accountCode: v.string(),
    lines: v.array(
      v.object({
        date: v.string(),
        description: v.string(),
        amount: v.number(),
        reference: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await ensureChartInternal(ctx, args.orgId);
    await assertCashAccount(ctx, args.orgId, args.accountCode);
    const now = tsNow();
    let imported = 0;
    for (const l of args.lines) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(l.date)) continue;
      if (!l.description?.trim() || !isFinite(l.amount) || l.amount === 0) continue;
      await ctx.db.insert("bankLines", {
        orgId: args.orgId,
        accountCode: args.accountCode,
        date: l.date,
        description: l.description.trim(),
        amount: Math.round(l.amount * 100) / 100,
        reference: l.reference?.trim() || undefined,
        status: "unmatched",
        createdAt: now,
      });
      imported++;
    }
    return { imported };
  },
});

export const listBankLines = query({
  args: { secret: v.string(), orgId: v.id("organizations"), accountCode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const all = await ctx.db.query("bankLines").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const rows = args.accountCode ? all.filter((l) => l.accountCode === args.accountCode) : all;
    rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    return rows.map((l) => ({
      id: l._id,
      accountCode: l.accountCode,
      date: l.date,
      description: l.description,
      amount: l.amount,
      reference: l.reference ?? null,
      status: l.status,
      journalId: l.journalId ?? null,
    }));
  },
});

export const matchBankLine = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    lineId: v.id("bankLines"),
    journalId: v.id("journals"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const line = await ctx.db.get(args.lineId);
    if (!line || line.orgId !== args.orgId) throw new Error("Bank line not found");
    const j = await ctx.db.get(args.journalId);
    if (!j || j.orgId !== args.orgId) throw new Error("Journal not found");
    await ctx.db.patch(line._id, { status: "matched", journalId: j._id });
    return true;
  },
});

export const postBankCharge = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    lineId: v.id("bankLines"),
    postedBy: v.optional(v.id("users")),
    postedByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const line = await ctx.db.get(args.lineId);
    if (!line || line.orgId !== args.orgId) throw new Error("Bank line not found");
    if (line.status === "matched") throw new Error("Already matched");
    if (line.amount >= 0) throw new Error("Only money-out lines can be booked as a charge");
    const amt = Math.abs(line.amount);
    const jid = await postJournalForSource(ctx, {
      orgId: args.orgId,
      source: "bank",
      sourceId: line._id,
      date: line.date,
      description: line.description,
      lines: [
        { accountCode: "5400", debit: amt, credit: 0, memo: line.reference },
        { accountCode: line.accountCode, debit: 0, credit: amt, memo: line.reference },
      ],
      postedBy: args.postedBy,
      postedByName: args.postedByName,
    });
    await ctx.db.patch(line._id, { status: "matched", journalId: jid });
    return jid;
  },
});

export const receiveAgainstInvoice = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    lineId: v.id("bankLines"),
    invoiceId: v.id("invoices"),
    postedBy: v.optional(v.id("users")),
    postedByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const line = await ctx.db.get(args.lineId);
    if (!line || line.orgId !== args.orgId) throw new Error("Bank line not found");
    if (line.amount <= 0) throw new Error("Only incoming money can be received against an invoice");
    const inv = await ctx.db.get(args.invoiceId);
    if (!inv || inv.orgId !== args.orgId) throw new Error("Invoice not found");
    const jid = await postJournalForSource(ctx, {
      orgId: args.orgId,
      source: "bank",
      sourceId: line._id,
      date: line.date,
      description: `Receipt ${inv.number}`,
      lines: [
        { accountCode: line.accountCode, debit: line.amount, credit: 0, memo: line.reference },
        { accountCode: "1100", debit: 0, credit: line.amount, memo: inv.number },
      ],
      postedBy: args.postedBy,
      postedByName: args.postedByName,
    });
    await ctx.db.patch(line._id, { status: "matched", journalId: jid });
    return jid;
  },
});

export const ignoreBankLine = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), lineId: v.id("bankLines") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const line = await ctx.db.get(args.lineId);
    if (!line || line.orgId !== args.orgId) throw new Error("Bank line not found");
    await ctx.db.patch(line._id, { status: "ignored" });
    return true;
  },
});

/* ------------------------------------------------------------------ *
 * Backfill: post journals for documents created before auto-posting
 * ------------------------------------------------------------------ */

export const backfill = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), postedByName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await ensureChartInternal(ctx, args.orgId);
    const by = args.postedByName ?? "Backfill";

    const countJournals = async () =>
      (await ctx.db.query("journals").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect()).length;
    const before = await countJournals();

    // Invoices issued (sent/paid/overdue)
    const invoices = await ctx.db.query("invoices").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    for (const inv of invoices) {
      if (!["sent", "paid", "overdue"].includes(inv.status)) continue;
      await tryPostJournalForSource(ctx, {
        orgId: args.orgId,
        source: "invoice",
        sourceId: inv._id,
        date: inv.issueDate,
        description: `Invoice ${inv.number} issued`,
        lines: [
          { accountCode: "1100", debit: inv.total, credit: 0, memo: inv.number },
          { accountCode: "4000", debit: 0, credit: inv.subtotal, memo: inv.number },
          { accountCode: "2150", debit: 0, credit: inv.taxTotal, memo: "VAT output" },
        ],
        postedByName: by,
      });
    }

    // Bills recorded
    const bills = await ctx.db.query("bills").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    for (const b of bills) {
      await tryPostJournalForSource(ctx, {
        orgId: args.orgId,
        source: "bill",
        sourceId: b._id,
        date: b.billDate,
        description: `Bill ${b.number}`,
        lines: [
          { accountCode: "5990", debit: b.amount, credit: 0, memo: b.number },
          { accountCode: "2000", debit: 0, credit: b.amount, memo: b.number },
        ],
        postedByName: by,
      });
      if (b.status === "paid") {
        await tryPostJournalForSource(ctx, {
          orgId: args.orgId,
          source: "bill",
          sourceId: `${b._id}:payment`,
          date: (b.paidAt ?? b.billDate).slice(0, 10),
          description: `Payment of bill ${b.number}`,
          lines: [
            { accountCode: "2000", debit: b.amount, credit: 0, memo: b.number },
            { accountCode: "1020", debit: 0, credit: b.amount, memo: b.number },
          ],
          postedByName: by,
        });
      }
    }

    // Petty cash approved/paid
    const petty = await ctx.db.query("pettyCash").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    for (const p of petty) {
      if (p.status !== "approved" && p.status !== "paid") continue;
      await tryPostJournalForSource(ctx, {
        orgId: args.orgId,
        source: "petty_cash",
        sourceId: p._id,
        date: p.dateNeeded,
        description: `Petty cash ${p.requisitionNo ?? ""} · ${p.purpose}`.trim(),
        lines: [
          { accountCode: "5990", debit: p.amount, credit: 0, memo: p.requisitionNo ?? undefined },
          { accountCode: "1010", debit: 0, credit: p.amount, memo: p.requisitionNo ?? undefined },
        ],
        postedByName: by,
      });
    }

    // Car logs approved
    const cars = await ctx.db.query("carLogs").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    for (const c of cars) {
      if (c.status !== "approved") continue;
      const expenseCode = c.category === "insurance" ? "5120" : "5110";
      await tryPostJournalForSource(ctx, {
        orgId: args.orgId,
        source: "car_log",
        sourceId: c._id,
        date: c.logDate,
        description: `Car ${c.category} · ${c.vehicleReg}`,
        lines: [
          { accountCode: expenseCode, debit: c.amount, credit: 0, memo: c.vehicleReg },
          { accountCode: "1020", debit: 0, credit: c.amount, memo: c.vehicleReg },
        ],
        postedByName: by,
      });
    }

    // Payroll runs
    const payrolls = await ctx.db.query("payrolls").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (const run of payrolls) {
      const t = run.payslips.reduce(
        (acc, s) => {
          acc.gross += s.grossPay;
          acc.paye += s.paye;
          acc.nssf += s.nssf;
          acc.sha += s.sha;
          acc.housing += s.housingLevy;
          acc.helb += s.helb;
          acc.pension += s.pension ?? 0;
          acc.net += s.netPay;
          return acc;
        },
        { gross: 0, paye: 0, nssf: 0, sha: 0, housing: 0, helb: 0, pension: 0, net: 0 }
      );
      const lastDay = new Date(Date.UTC(run.year, run.month, 0)).toISOString().slice(0, 10);
      await tryPostJournalForSource(ctx, {
        orgId: args.orgId,
        source: "payroll",
        sourceId: run._id,
        date: lastDay,
        description: `Payroll ${MONTHS[run.month - 1]} ${run.year}`,
        lines: [
          { accountCode: "5000", debit: t.gross, credit: 0, memo: "Gross pay" },
          { accountCode: "2100", debit: 0, credit: t.paye, memo: "PAYE" },
          { accountCode: "2110", debit: 0, credit: t.nssf, memo: "NSSF" },
          { accountCode: "2120", debit: 0, credit: t.sha, memo: "SHIF" },
          { accountCode: "2130", debit: 0, credit: t.housing, memo: "Housing levy" },
          { accountCode: "2160", debit: 0, credit: t.helb, memo: "HELB" },
          { accountCode: "2170", debit: 0, credit: t.pension, memo: "Pension" },
          { accountCode: "1020", debit: 0, credit: t.net, memo: "Net pay" },
        ],
        postedByName: by,
      });
    }

    const after = await countJournals();
    return { created: after - before };
  },
});

/* ------------------------------------------------------------------ *
 * VAT return (VAT3 working paper)
 * ------------------------------------------------------------------ */

export const vatReturn = query({
  args: { secret: v.string(), orgId: v.id("organizations"), period: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const journals = await ctx.db
      .query("journals")
      .withIndex("by_org_period", (q) => q.eq("orgId", args.orgId).eq("period", args.period))
      .collect();
    let output = 0;
    let input = 0;
    const outputLines: Array<{ ref: string; date: string; description: string; amount: number }> = [];
    const inputLines: Array<{ ref: string; date: string; description: string; amount: number }> = [];
    for (const j of journals) {
      if (j.source === "vat") continue;
      for (const l of j.lines) {
        if (l.accountCode === "2150") {
          const net = l.credit - l.debit;
          if (net !== 0) {
            output += net;
            outputLines.push({ ref: j.ref, date: j.date, description: j.description, amount: roundKes(net) });
          }
        }
        if (l.accountCode === "1150") {
          const net = l.debit - l.credit;
          if (net !== 0) {
            input += net;
            inputLines.push({ ref: j.ref, date: j.date, description: j.description, amount: roundKes(net) });
          }
        }
      }
    }
    return {
      period: args.period,
      output: roundKes(output),
      input: roundKes(input),
      payable: roundKes(output - input),
      outputLines,
      inputLines,
    };
  },
});
