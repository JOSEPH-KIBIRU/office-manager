import { query, mutation, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { assertSecret, tsNow } from "./lib";
import { postJournalForSource, reverseJournalInternal, resolveControlCode, roundKes } from "./accounting";

/**
 * Banking module — built on top of the existing double-entry ledger.
 *
 * Bank and M-Pesa accounts are backed by `ledgerAccounts` (asset, isCash).
 * Imported statement movements live in `bankLines`; matching them creates
 * `bankLineMatches` that link to journals/receipts. Nothing is ever deleted;
 * lines move through statuses: unmatched → partially_matched → matched →
 * reconciled (or ignored).
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

async function accountOrThrow(ctx: MutationCtx | QueryCtx, orgId: Id<"organizations">, code: string) {
  const acct = await ctx.db
    .query("ledgerAccounts")
    .withIndex("by_org_code", (q) => q.eq("orgId", orgId).eq("code", code))
    .first();
  if (!acct) throw new Error(`Ledger account ${code} not found`);
  return acct;
}

async function nextFreeAssetCode(ctx: MutationCtx, orgId: Id<"organizations">): Promise<string> {
  const rows = await ctx.db.query("ledgerAccounts").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  const used = new Set(rows.map((r) => r.code));
  for (let n = 1040; n <= 1089; n++) {
    const code = String(n);
    if (!used.has(code)) return code;
  }
  throw new Error("No free ledger account code in the 1040–1089 range. Create one manually.");
}

async function lineMatched(ctx: MutationCtx | QueryCtx, lineId: Id<"bankLines">): Promise<number> {
  const rows = await ctx.db.query("bankLineMatches").withIndex("by_line", (q) => q.eq("bankLineId", lineId)).collect();
  return round2(rows.reduce((s, m) => s + m.amount, 0));
}

async function recomputeLine(ctx: MutationCtx, lineId: Id<"bankLines">): Promise<void> {
  const line = await ctx.db.get(lineId);
  if (!line) return;
  if (line.status === "ignored" || line.status === "reconciled") return;
  const matched = await lineMatched(ctx, lineId);
  const target = Math.abs(line.amount);
  const status = matched <= 0.005 ? "unmatched" : matched >= target - 0.005 ? "matched" : "partially_matched";
  await ctx.db.patch(lineId, { status });
}

/** Ledger balance for one account, from the journals. */
async function ledgerBalance(ctx: QueryCtx | MutationCtx, orgId: Id<"organizations">, code: string): Promise<number> {
  const journals = await ctx.db.query("journals").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  let debit = 0;
  let credit = 0;
  for (const j of journals) for (const l of j.lines) {
    if (l.accountCode !== code) continue;
    debit += l.debit;
    credit += l.credit;
  }
  return roundKes(debit - credit);
}

/* ------------------------------------------------------------------ *
 * Accounts
 * ------------------------------------------------------------------ */

export const listBankAccounts = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("bankAccounts").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const out = [];
    for (const a of rows.sort((x, y) => x.name.localeCompare(y.name))) {
      out.push({
        id: a._id,
        kind: a.kind,
        name: a.name,
        bankName: a.bankName ?? null,
        accountNumber: a.accountNumber ?? null,
        currency: a.currency,
        openingBalance: a.openingBalance,
        accountCode: a.accountCode,
        paybill: a.paybill ?? null,
        till: a.till ?? null,
        businessNumber: a.businessNumber ?? null,
        active: a.active,
        currentBalance: await ledgerBalance(ctx, args.orgId, a.accountCode),
      });
    }
    return out;
  },
});

export const createBankAccount = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    kind: v.union(v.literal("bank"), v.literal("mpesa")),
    name: v.string(),
    bankName: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    currency: v.optional(v.string()),
    openingBalance: v.optional(v.number()),
    accountCode: v.optional(v.string()),
    paybill: v.optional(v.string()),
    till: v.optional(v.string()),
    businessNumber: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const name = args.name.trim();
    if (!name) throw new Error("Account name is required");

    let code = args.accountCode?.trim();
    if (code) {
      const acct = await accountOrThrow(ctx, args.orgId, code);
      if (!acct.isCash) throw new Error("The linked ledger account must be flagged as a cash/bank account.");
    } else {
      code = await nextFreeAssetCode(ctx, args.orgId);
      await ctx.db.insert("ledgerAccounts", {
        orgId: args.orgId,
        code,
        name,
        type: "asset",
        group: "Current assets",
        category: "current",
        isCash: true,
        control: args.kind === "mpesa" ? undefined : "bank",
        active: true,
        createdAt: tsNow(),
      });
    }

    const openingBalance = round2(args.openingBalance ?? 0);
    if (openingBalance !== 0) {
      // Opening balance is a controlled entry (source: opening), never income.
      const suspense = await resolveControlCode(ctx, args.orgId, "suspense");
      await postJournalForSource(ctx, {
        orgId: args.orgId,
        source: "opening",
        sourceId: `bank:${code}`,
        date: new Date().toISOString().slice(0, 10),
        description: `Opening balance — ${name}`,
        lines:
          openingBalance > 0
            ? [
                { accountCode: code, debit: openingBalance, credit: 0, memo: "Opening balance" },
                { accountCode: suspense, debit: 0, credit: openingBalance, memo: "Opening balance" },
              ]
            : [
                { accountCode: suspense, debit: -openingBalance, credit: 0, memo: "Opening balance" },
                { accountCode: code, debit: 0, credit: -openingBalance, memo: "Opening balance" },
              ],
      });
    }

    const id = await ctx.db.insert("bankAccounts", {
      orgId: args.orgId,
      kind: args.kind,
      name,
      bankName: args.bankName?.trim() || undefined,
      accountNumber: args.accountNumber?.trim() || undefined,
      currency: args.currency?.trim() || "KES",
      openingBalance,
      accountCode: code,
      paybill: args.paybill?.trim() || undefined,
      till: args.till?.trim() || undefined,
      businessNumber: args.businessNumber?.trim() || undefined,
      active: true,
      createdBy: args.createdBy,
      createdAt: tsNow(),
      updatedAt: tsNow(),
    });
    return { id, accountCode: code };
  },
});

export const updateBankAccount = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("bankAccounts"),
    name: v.optional(v.string()),
    bankName: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    currency: v.optional(v.string()),
    paybill: v.optional(v.string()),
    till: v.optional(v.string()),
    businessNumber: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Bank account not found");
    const patch: Record<string, unknown> = { updatedAt: tsNow() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.bankName !== undefined) patch.bankName = args.bankName?.trim() || undefined;
    if (args.accountNumber !== undefined) patch.accountNumber = args.accountNumber?.trim() || undefined;
    if (args.currency !== undefined) patch.currency = args.currency.trim() || "KES";
    if (args.paybill !== undefined) patch.paybill = args.paybill?.trim() || undefined;
    if (args.till !== undefined) patch.till = args.till?.trim() || undefined;
    if (args.businessNumber !== undefined) patch.businessNumber = args.businessNumber?.trim() || undefined;
    if (args.active !== undefined) patch.active = args.active;
    await ctx.db.patch(args.id, patch);
    return true;
  },
});

/* ------------------------------------------------------------------ *
 * Transactions
 * ------------------------------------------------------------------ */

async function enrichLine(ctx: QueryCtx, orgId: Id<"organizations">, line: any) {
  const matched = await lineMatched(ctx, line._id);
  const target = Math.abs(line.amount);
  return {
    id: line._id,
    accountCode: line.accountCode,
    bankAccountId: line.bankAccountId ?? null,
    date: line.date,
    description: line.description,
    amount: line.amount,
    reference: line.reference ?? null,
    status: line.status,
    source: line.source ?? "import",
    matched,
    remaining: round2(target - matched),
    journalId: line.journalId ?? null,
    notes: line.notes ?? null,
  };
}

export const listTransactions = query({
  args: { secret: v.string(), orgId: v.id("organizations"), accountCode: v.optional(v.string()), onlyUnreconciled: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const all = await ctx.db.query("bankLines").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const filtered = all
      .filter((l) => (!args.accountCode || l.accountCode === args.accountCode))
      .filter((l) => (!args.onlyUnreconciled || (l.status !== "reconciled" && l.status !== "ignored")))
      .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)));
    return Promise.all(filtered.map((l) => enrichLine(ctx, args.orgId, l)));
  },
});

/** Insert statement lines, de-duplicating identical date+amount+description. */
export const importTransactions = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    accountCode: v.string(),
    bankAccountId: v.optional(v.id("bankAccounts")),
    importRef: v.optional(v.string()),
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
    await accountOrThrow(ctx, args.orgId, args.accountCode);
    const existing = await ctx.db
      .query("bankLines")
      .withIndex("by_org_account", (q) => q.eq("orgId", args.orgId).eq("accountCode", args.accountCode))
      .collect();
    const seen = new Set(existing.map((l) => `${l.date}|${round2(l.amount)}|${l.description.trim().toLowerCase()}`));
    let imported = 0;
    let skipped = 0;
    for (const l of args.lines) {
      const key = `${l.date}|${round2(l.amount)}|${l.description.trim().toLowerCase()}`;
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key);
      await ctx.db.insert("bankLines", {
        orgId: args.orgId,
        accountCode: args.accountCode,
        bankAccountId: args.bankAccountId,
        date: l.date,
        description: l.description.trim(),
        amount: round2(l.amount),
        reference: l.reference?.trim() || undefined,
        status: "unmatched",
        source: "import",
        importRef: args.importRef,
        createdAt: tsNow(),
      });
      imported += 1;
    }
    return { imported, skipped };
  },
});

/** Record a manual bank movement (deposit/withdrawal/charge/interest) with an optional counter-account. */
export const createManualTransaction = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    accountCode: v.string(),
    bankAccountId: v.optional(v.id("bankAccounts")),
    date: v.string(),
    description: v.string(),
    amount: v.number(),
    reference: v.optional(v.string()),
    counterAccountCode: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await accountOrThrow(ctx, args.orgId, args.accountCode);
    if (!(Math.abs(args.amount) > 0)) throw new Error("Amount must not be zero");
    const lineId = await ctx.db.insert("bankLines", {
      orgId: args.orgId,
      accountCode: args.accountCode,
      bankAccountId: args.bankAccountId,
      date: args.date,
      description: args.description.trim() || "Bank transaction",
      amount: round2(args.amount),
      reference: args.reference?.trim() || undefined,
      status: "unmatched",
      source: args.source ?? "manual",
      createdAt: tsNow(),
    });

    if (args.counterAccountCode) {
      const counter = await accountOrThrow(ctx, args.orgId, args.counterAccountCode);
      if (counter.isCash) throw new Error("Use a transfer to move money between your own accounts.");
      const amt = Math.abs(round2(args.amount));
      const journalId = await postJournalForSource(ctx, {
        orgId: args.orgId,
        source: "bank",
        sourceId: lineId,
        date: args.date,
        description: args.description.trim() || "Bank transaction",
        lines:
          args.amount > 0
            ? [
                { accountCode: args.accountCode, debit: amt, credit: 0, memo: args.reference },
                { accountCode: args.counterAccountCode, debit: 0, credit: amt, memo: args.reference },
              ]
            : [
                { accountCode: args.counterAccountCode, debit: amt, credit: 0, memo: args.reference },
                { accountCode: args.accountCode, debit: 0, credit: amt, memo: args.reference },
              ],
      });
      await ctx.db.insert("bankLineMatches", {
        orgId: args.orgId,
        bankLineId: lineId,
        amount: amt,
        journalId,
        note: "Manual entry",
        createdAt: tsNow(),
      });
      await recomputeLine(ctx, lineId);
    }
    return { id: lineId };
  },
});

/* ------------------------------------------------------------------ *
 * Transfers
 * ------------------------------------------------------------------ */

export const createTransfer = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    date: v.string(),
    fromAccountCode: v.string(),
    toAccountCode: v.string(),
    amount: v.number(),
    reference: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    createdByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    if (args.fromAccountCode === args.toAccountCode) throw new Error("Choose two different accounts.");
    const from = await accountOrThrow(ctx, args.orgId, args.fromAccountCode);
    const to = await accountOrThrow(ctx, args.orgId, args.toAccountCode);
    if (!from.isCash || !to.isCash) throw new Error("Transfers must be between cash/bank accounts.");
    const amount = round2(args.amount);
    if (!(amount > 0)) throw new Error("Amount must be greater than zero.");

    const journalId = await postJournalForSource(ctx, {
      orgId: args.orgId,
      source: "bank",
      sourceId: `transfer:${args.fromAccountCode}:${args.toAccountCode}:${Date.now()}`,
      date: args.date,
      description: `Transfer ${args.fromAccountCode} → ${args.toAccountCode}${args.reference ? ` · ${args.reference}` : ""}`,
      lines: [
        { accountCode: args.toAccountCode, debit: amount, credit: 0, memo: args.reference },
        { accountCode: args.fromAccountCode, debit: 0, credit: amount, memo: args.reference },
      ],
      postedBy: args.createdBy,
      postedByName: args.createdByName ?? "Transfer",
    });

    // Register both legs as already-matched movements (internal, not income/expense).
    const outId = await ctx.db.insert("bankLines", {
      orgId: args.orgId,
      accountCode: args.fromAccountCode,
      date: args.date,
      description: `Transfer to ${args.toAccountCode}`,
      amount: -amount,
      reference: args.reference?.trim() || undefined,
      status: "matched",
      source: "transfer",
      journalId,
      createdAt: tsNow(),
    });
    const inId = await ctx.db.insert("bankLines", {
      orgId: args.orgId,
      accountCode: args.toAccountCode,
      date: args.date,
      description: `Transfer from ${args.fromAccountCode}`,
      amount: amount,
      reference: args.reference?.trim() || undefined,
      status: "matched",
      source: "transfer",
      journalId,
      createdAt: tsNow(),
    });
    await ctx.db.insert("bankLineMatches", { orgId: args.orgId, bankLineId: outId, amount, journalId, note: "Transfer", createdAt: tsNow() });
    await ctx.db.insert("bankLineMatches", { orgId: args.orgId, bankLineId: inId, amount, journalId, note: "Transfer", createdAt: tsNow() });

    const id = await ctx.db.insert("bankTransfers", {
      orgId: args.orgId,
      date: args.date,
      fromAccountCode: args.fromAccountCode,
      toAccountCode: args.toAccountCode,
      amount,
      reference: args.reference?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      journalId,
      createdBy: args.createdBy,
      createdByName: args.createdByName,
      createdAt: tsNow(),
    });
    return { id, journalId };
  },
});

export const listTransfers = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("bankTransfers").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt).map((t) => ({
      id: t._id,
      date: t.date,
      fromAccountCode: t.fromAccountCode,
      toAccountCode: t.toAccountCode,
      amount: t.amount,
      reference: t.reference ?? null,
      notes: t.notes ?? null,
    }));
  },
});

/* ------------------------------------------------------------------ *
 * Matching & classification
 * ------------------------------------------------------------------ */

export const matchLineToJournal = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    lineId: v.id("bankLines"),
    journalId: v.id("journals"),
    amount: v.optional(v.number()),
    createdByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const line = await ctx.db.get(args.lineId);
    if (!line || line.orgId !== args.orgId) throw new Error("Bank transaction not found");
    if (line.status === "reconciled") throw new Error("This transaction is already reconciled.");
    const journal = await ctx.db.get(args.journalId);
    if (!journal || journal.orgId !== args.orgId) throw new Error("Journal not found");
    const remaining = round2(Math.abs(line.amount) - (await lineMatched(ctx, args.lineId)));
    const amount = round2(Math.min(args.amount ?? remaining, remaining));
    if (!(amount > 0)) throw new Error("Nothing left to match on this line.");
    await ctx.db.insert("bankLineMatches", {
      orgId: args.orgId,
      bankLineId: args.lineId,
      amount,
      journalId: args.journalId,
      note: "Matched to book entry",
      createdByName: args.createdByName,
      createdAt: tsNow(),
    });
    await recomputeLine(ctx, args.lineId);
    return { matched: amount };
  },
});

/** Create a receipt (money in) from a statement line: Dr Bank, Cr AR. */
export const receiptFromLine = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    lineId: v.id("bankLines"),
    contactId: v.optional(v.id("contacts")),
    amount: v.optional(v.number()),
    createdByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const line = await ctx.db.get(args.lineId);
    if (!line || line.orgId !== args.orgId) throw new Error("Bank transaction not found");
    if (line.amount <= 0) throw new Error("Only incoming money can be received.");
    const remaining = round2(Math.abs(line.amount) - (await lineMatched(ctx, args.lineId)));
    const amount = round2(Math.min(args.amount ?? remaining, remaining));
    if (!(amount > 0)) throw new Error("Nothing left to match on this line.");
    const ar = await resolveControlCode(ctx, args.orgId, "ar");
    const journalId = await postJournalForSource(ctx, {
      orgId: args.orgId,
      source: "bank",
      sourceId: `receipt:${line._id}:${Date.now()}`,
      date: line.date,
      description: `Receipt — ${line.description}`,
      lines: [
        { accountCode: line.accountCode, debit: amount, credit: 0, memo: line.reference },
        { accountCode: ar, debit: 0, credit: amount, memo: line.reference },
      ],
      postedByName: args.createdByName ?? "Reconciliation",
    });
    await ctx.db.insert("bankLineMatches", {
      orgId: args.orgId,
      bankLineId: args.lineId,
      amount,
      journalId,
      note: "Receipt created",
      createdByName: args.createdByName,
      createdAt: tsNow(),
    });
    if (args.contactId) await ctx.db.insert("payments", {
      orgId: args.orgId,
      contactId: args.contactId,
      kind: "receipt",
      date: line.date,
      amount,
      method: "bank",
      accountCode: line.accountCode,
      reference: line.reference ?? undefined,
      journalId,
      createdByName: args.createdByName ?? "Reconciliation",
      createdAt: tsNow(),
    });
    await recomputeLine(ctx, args.lineId);
    return { journalId, amount };
  },
});

/** Create a payment (money out) from a statement line: Dr AP, Cr Bank. */
export const paymentFromLine = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    lineId: v.id("bankLines"),
    contactId: v.optional(v.id("contacts")),
    amount: v.optional(v.number()),
    createdByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const line = await ctx.db.get(args.lineId);
    if (!line || line.orgId !== args.orgId) throw new Error("Bank transaction not found");
    if (line.amount >= 0) throw new Error("Only outgoing money can be paid.");
    const remaining = round2(Math.abs(line.amount) - (await lineMatched(ctx, args.lineId)));
    const amount = round2(Math.min(args.amount ?? remaining, remaining));
    if (!(amount > 0)) throw new Error("Nothing left to match on this line.");
    const ap = await resolveControlCode(ctx, args.orgId, "ap");
    const journalId = await postJournalForSource(ctx, {
      orgId: args.orgId,
      source: "bank",
      sourceId: `payment:${line._id}:${Date.now()}`,
      date: line.date,
      description: `Payment — ${line.description}`,
      lines: [
        { accountCode: ap, debit: amount, credit: 0, memo: line.reference },
        { accountCode: line.accountCode, debit: 0, credit: amount, memo: line.reference },
      ],
      postedByName: args.createdByName ?? "Reconciliation",
    });
    await ctx.db.insert("bankLineMatches", {
      orgId: args.orgId,
      bankLineId: args.lineId,
      amount,
      journalId,
      note: "Payment created",
      createdByName: args.createdByName,
      createdAt: tsNow(),
    });
    if (args.contactId) await ctx.db.insert("payments", {
      orgId: args.orgId,
      contactId: args.contactId,
      kind: "payment",
      date: line.date,
      amount,
      method: "bank",
      accountCode: line.accountCode,
      reference: line.reference ?? undefined,
      journalId,
      createdByName: args.createdByName ?? "Reconciliation",
      createdAt: tsNow(),
    });
    await recomputeLine(ctx, args.lineId);
    return { journalId, amount };
  },
});

/** Classify a line directly to an expense/income account (bank charge, interest, etc.). */
export const expenseFromLine = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    lineId: v.id("bankLines"),
    counterAccountCode: v.string(),
    amount: v.optional(v.number()),
    createdByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const line = await ctx.db.get(args.lineId);
    if (!line || line.orgId !== args.orgId) throw new Error("Bank transaction not found");
    const counter = await accountOrThrow(ctx, args.orgId, args.counterAccountCode);
    if (counter.isCash) throw new Error("Use a transfer to move money between accounts.");
    const remaining = round2(Math.abs(line.amount) - (await lineMatched(ctx, args.lineId)));
    const amount = round2(Math.min(args.amount ?? remaining, remaining));
    if (!(amount > 0)) throw new Error("Nothing left to match on this line.");
    const journalId = await postJournalForSource(ctx, {
      orgId: args.orgId,
      source: "bank",
      sourceId: `expense:${line._id}:${Date.now()}`,
      date: line.date,
      description: line.description,
      lines:
        line.amount > 0
          ? [
              { accountCode: line.accountCode, debit: amount, credit: 0, memo: line.reference },
              { accountCode: counter.code, debit: 0, credit: amount, memo: line.reference },
            ]
          : [
              { accountCode: counter.code, debit: amount, credit: 0, memo: line.reference },
              { accountCode: line.accountCode, debit: 0, credit: amount, memo: line.reference },
            ],
      postedByName: args.createdByName ?? "Reconciliation",
    });
    await ctx.db.insert("bankLineMatches", {
      orgId: args.orgId,
      bankLineId: args.lineId,
      amount,
      journalId,
      note: `Classified to ${counter.code}`,
      createdByName: args.createdByName,
      createdAt: tsNow(),
    });
    await recomputeLine(ctx, args.lineId);
    return { journalId, amount };
  },
});

export const ignoreLine = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), lineId: v.id("bankLines") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const line = await ctx.db.get(args.lineId);
    if (!line || line.orgId !== args.orgId) throw new Error("Bank transaction not found");
    if (line.status === "reconciled") throw new Error("Reconciled transactions cannot be ignored.");
    await ctx.db.patch(args.lineId, { status: "ignored" });
    return true;
  },
});

/** Remove the allocations from a line (does not reverse journals). */
export const unmatchLine = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), lineId: v.id("bankLines") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const line = await ctx.db.get(args.lineId);
    if (!line || line.orgId !== args.orgId) throw new Error("Bank transaction not found");
    if (line.status === "reconciled") throw new Error("Reconciled transactions cannot be unmatched.");
    const matches = await ctx.db.query("bankLineMatches").withIndex("by_line", (q) => q.eq("bankLineId", args.lineId)).collect();
    for (const m of matches) await ctx.db.delete(m._id);
    await ctx.db.patch(args.lineId, { status: "unmatched" });
    return true;
  },
});

/* ------------------------------------------------------------------ *
 * Rules
 * ------------------------------------------------------------------ */

export const listBankRules = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("bankRules").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const createBankRule = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    name: v.string(),
    matchField: v.union(v.literal("description"), v.literal("reference")),
    matchType: v.union(v.literal("contains"), v.literal("equals"), v.literal("starts_with")),
    matchValue: v.string(),
    suggestAccountCode: v.string(),
    suggestType: v.optional(v.string()),
    autoPost: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    if (!args.name.trim() || !args.matchValue.trim()) throw new Error("Rule name and match value are required");
    await accountOrThrow(ctx, args.orgId, args.suggestAccountCode);
    const id = await ctx.db.insert("bankRules", {
      orgId: args.orgId,
      name: args.name.trim(),
      matchField: args.matchField,
      matchType: args.matchType,
      matchValue: args.matchValue.trim(),
      suggestAccountCode: args.suggestAccountCode,
      suggestType: args.suggestType,
      autoPost: args.autoPost ?? false,
      active: true,
      createdAt: tsNow(),
      updatedAt: tsNow(),
    });
    return { id };
  },
});

export const updateBankRule = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("bankRules"),
    active: v.optional(v.boolean()),
    autoPost: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Rule not found");
    const patch: Record<string, unknown> = { updatedAt: tsNow() };
    if (args.active !== undefined) patch.active = args.active;
    if (args.autoPost !== undefined) patch.autoPost = args.autoPost;
    await ctx.db.patch(args.id, patch);
    return true;
  },
});

export const deleteBankRule = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("bankRules") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Rule not found");
    await ctx.db.delete(args.id);
    return true;
  },
});

function ruleMatches(rule: any, text: string, ref: string): boolean {
  const hay = (rule.matchField === "reference" ? ref : text).toLowerCase();
  const needle = rule.matchValue.toLowerCase();
  if (rule.matchType === "equals") return hay === needle;
  if (rule.matchType === "starts_with") return hay.startsWith(needle);
  return hay.includes(needle);
}

/** Suggestions for a line: rule match + candidate book entries with the same amount. */
export const suggestForLine = query({
  args: { secret: v.string(), orgId: v.id("organizations"), lineId: v.id("bankLines") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const line = await ctx.db.get(args.lineId);
    if (!line || line.orgId !== args.orgId) throw new Error("Bank transaction not found");
    const rules = await ctx.db.query("bankRules").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const rule = rules
      .filter((r) => r.active && ruleMatches(r, line.description, line.reference ?? ""))
      .sort((a, b) => (b.autoPost ? 1 : 0) - (a.autoPost ? 1 : 0))[0];

    // Candidate book entries (journals touching another account) with the same amount, ±7 days.
    const target = Math.abs(line.amount);
    const d = new Date(line.date + "T00:00:00Z").getTime();
    const journals = await ctx.db.query("journals").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const candidates = journals
      .filter((j) => {
        if (j.reversedBy) return false;
        const jd = new Date(j.date + "T00:00:00Z").getTime();
        if (Number.isNaN(jd) || Math.abs(jd - d) > 7 * 86_400_000) return false;
        return j.lines.some((l) => {
          if (l.accountCode === line.accountCode) return false;
          const amt = l.debit || l.credit;
          return Math.abs(amt - target) <= 0.5;
        });
      })
      .slice(0, 10)
      .map((j) => ({
        journalId: j._id,
        ref: j.ref,
        date: j.date,
        description: j.description,
        amount: target,
        confidence: j.date === line.date ? "high" : "medium",
      }));

    return {
      rule: rule
        ? { id: rule._id, name: rule.name, accountCode: rule.suggestAccountCode, autoPost: rule.autoPost, suggestType: rule.suggestType ?? null }
        : null,
      candidates,
    };
  },
});

/* ------------------------------------------------------------------ *
 * Reconciliation
 * ------------------------------------------------------------------ */

/**
 * Build the two-sided reconciliation ledger:
 *  - Cash Book side  = journals that touch the bank account
 *  - Bank Statement side = imported `bankLines`
 * Matched items appear on both; anything left over is isolated into the classic
 * categories: Unpresented Cheques, Uncredited Deposits, Direct Debits, Direct Credits.
 */
async function buildReconciliation(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations">,
  accountCode: string,
  statementClosingBalance: number
) {
  const matches = await ctx.db.query("bankLineMatches").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  const byJournal = new Map<string, number>();
  const byLine = new Map<string, number>();
  for (const m of matches) {
    if (m.journalId) byJournal.set(m.journalId, (byJournal.get(m.journalId) ?? 0) + m.amount);
    byLine.set(m.bankLineId, (byLine.get(m.bankLineId) ?? 0) + m.amount);
  }

  // ---- Cash Book side (recorded entries affecting this bank account) ----
  const journals = await ctx.db.query("journals").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  const unpresentedCheques: Array<Record<string, unknown>> = [];
  const uncreditedDeposits: Array<Record<string, unknown>> = [];
  const matchedItems: Array<Record<string, unknown>> = [];
  for (const j of journals) {
    if (j.reversedBy) continue;
    if (j.source === "opening") continue; // starting balance, not an outstanding item
    let effect = 0;
    for (const l of j.lines) if (l.accountCode === accountCode) effect += l.debit - l.credit;
    effect = round2(effect);
    if (Math.abs(effect) < 0.005) continue;
    const matched = round2(byJournal.get(j._id) ?? 0);
    const remaining = round2(Math.abs(effect) - matched);
    const item = {
      journalId: j._id,
      ref: j.ref,
      date: j.date,
      description: j.description,
      amount: round2(Math.abs(effect)),
      matched,
      remaining,
      direction: effect > 0 ? "in" : "out",
    };
    if (remaining <= 0.005) matchedItems.push(item);
    else if (effect > 0) uncreditedDeposits.push(item);
    else unpresentedCheques.push(item);
  }

  // ---- Bank Statement side (imported movements) ----
  const lines = await ctx.db
    .query("bankLines")
    .withIndex("by_org_account", (q) => q.eq("orgId", orgId).eq("accountCode", accountCode))
    .collect();
  const directDebits: Array<Record<string, unknown>> = [];
  const directCredits: Array<Record<string, unknown>> = [];
  let statementMovement = 0;
  for (const l of lines) {
    if (l.status === "ignored") continue;
    statementMovement += l.amount;
    const matched = round2(byLine.get(l._id) ?? 0);
    const remaining = round2(Math.abs(l.amount) - matched);
    if (remaining <= 0.005) continue;
    const item = {
      id: l._id,
      date: l.date,
      description: l.description,
      amount: round2(Math.abs(l.amount)),
      matched,
      remaining,
      reference: l.reference ?? null,
      direction: l.amount > 0 ? "in" : "out",
    };
    if (l.amount > 0) directCredits.push(item);
    else directDebits.push(item);
  }

  const bookBalance = await ledgerBalance(ctx, orgId, accountCode);
  const totals = {
    unpresentedCheques: round2(unpresentedCheques.reduce((s, i) => s + Number(i.remaining), 0)),
    uncreditedDeposits: round2(uncreditedDeposits.reduce((s, i) => s + Number(i.remaining), 0)),
    directDebits: round2(directDebits.reduce((s, i) => s + Number(i.remaining), 0)),
    directCredits: round2(directCredits.reduce((s, i) => s + Number(i.remaining), 0)),
  };
  const adjustedBank = round2(statementClosingBalance + totals.uncreditedDeposits - totals.unpresentedCheques);
  const adjustedBook = round2(bookBalance + totals.directCredits - totals.directDebits);
  const difference = round2(adjustedBank - adjustedBook);

  return {
    accountCode,
    bookBalance,
    statementClosingBalance: round2(statementClosingBalance),
    statementMovement: round2(statementMovement),
    matchedCount: matchedItems.length,
    unpresentedCheques,
    uncreditedDeposits,
    directDebits,
    directCredits,
    totals,
    adjustedBank,
    adjustedBook,
    difference,
    unreconciledCount:
      unpresentedCheques.length + uncreditedDeposits.length + directDebits.length + directCredits.length,
  };
}

/** Full two-sided reconciliation ledger (Cash Book vs Bank Statement). */
export const reconciliationLedger = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    accountCode: v.string(),
    statementClosingBalance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    return buildReconciliation(ctx, args.orgId, args.accountCode, args.statementClosingBalance ?? 0);
  },
});

export const reconciliationSummary = query({
  args: { secret: v.string(), orgId: v.id("organizations"), accountCode: v.string(), statementClosingBalance: v.number() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const r = await buildReconciliation(ctx, args.orgId, args.accountCode, args.statementClosingBalance);
    return {
      bookBalance: r.bookBalance,
      outstandingDeposits: r.totals.uncreditedDeposits,
      outstandingPayments: r.totals.unpresentedCheques,
      adjustedBalance: r.adjustedBook,
      difference: r.difference,
      unreconciledCount: r.unreconciledCount,
    };
  },
});

/**
 * Automated matching engine: pairs statement entries with Cash Book entries of
 * the same direction and amount within a date window, creating the matches.
 */
export const autoMatch = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    accountCode: v.string(),
    windowDays: v.optional(v.number()),
    createdByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const window = Math.max(0, Math.min(args.windowDays ?? 7, 45));

    // Statement side remaining.
    const lines = await ctx.db
      .query("bankLines")
      .withIndex("by_org_account", (q) => q.eq("orgId", args.orgId).eq("accountCode", args.accountCode))
      .collect();
    const lineState = [];
    for (const l of lines) {
      if (l.status === "ignored" || l.status === "reconciled") continue;
      const remaining = round2(Math.abs(l.amount) - (await lineMatched(ctx, l._id)));
      if (remaining <= 0.005) continue;
      lineState.push({ id: l._id, amount: l.amount, remaining, date: l.date, description: l.description, reference: l.reference ?? "" });
    }

    // Cash book side remaining.
    const journals = await ctx.db.query("journals").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const matches = await ctx.db.query("bankLineMatches").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const byJournal = new Map<string, number>();
    for (const m of matches) if (m.journalId) byJournal.set(m.journalId, (byJournal.get(m.journalId) ?? 0) + m.amount);
    const bookState = [];
    for (const j of journals) {
      if (j.reversedBy || j.source === "opening") continue;
      let effect = 0;
      for (const l of j.lines) if (l.accountCode === args.accountCode) effect += l.debit - l.credit;
      effect = round2(effect);
      if (Math.abs(effect) < 0.005) continue;
      const remaining = round2(Math.abs(effect) - (byJournal.get(j._id) ?? 0));
      if (remaining <= 0.005) continue;
      bookState.push({ journalId: j._id, effect, remaining, date: j.date, description: j.description, ref: j.ref });
    }

    // Build candidate pairs.
    const dayMs = 86_400_000;
    const pairs: Array<{ lineIdx: number; bookIdx: number; amount: number; score: number }> = [];
    for (let li = 0; li < lineState.length; li++) {
      const ls = lineState[li];
      for (let bi = 0; bi < bookState.length; bi++) {
        const bs = bookState[bi];
        if (ls.amount > 0 !== bs.effect > 0) continue; // same direction only
        const amount = Math.min(ls.remaining, bs.remaining);
        const diff = Math.abs(ls.remaining - bs.remaining);
        if (diff > 0.5 && amount < Math.min(ls.remaining, bs.remaining) - 0.005) continue;
        const dd = Math.abs(Date.parse(ls.date + "T00:00:00Z") - Date.parse(bs.date + "T00:00:00Z")) / dayMs;
        if (Number.isNaN(dd) || dd > window) continue;
        let score = 100 - dd;
        if (ls.remaining === bs.remaining) score += 30;
        const refHit = ls.reference && bs.ref && ls.reference.toLowerCase().includes(bs.ref.toLowerCase());
        if (refHit) score += 25;
        pairs.push({ lineIdx: li, bookIdx: bi, amount: round2(amount), score });
      }
    }
    pairs.sort((a, b) => b.score - a.score);

    let matched = 0;
    const touched = new Set<string>();
    for (const p of pairs) {
      const ls = lineState[p.lineIdx];
      const bs = bookState[p.bookIdx];
      if (ls.remaining <= 0.005 || bs.remaining <= 0.005) continue;
      const amount = round2(Math.min(ls.remaining, bs.remaining));
      if (amount <= 0.005) continue;
      await ctx.db.insert("bankLineMatches", {
        orgId: args.orgId,
        bankLineId: ls.id,
        amount,
        journalId: bs.journalId,
        note: "Auto-matched",
        createdByName: args.createdByName ?? "Auto-match",
        createdAt: tsNow(),
      });
      ls.remaining = round2(ls.remaining - amount);
      bs.remaining = round2(bs.remaining - amount);
      touched.add(ls.id);
      matched += 1;
    }
    for (const id of touched) await recomputeLine(ctx, id as Id<"bankLines">);

    return { matched, remainingLines: lineState.filter((l) => l.remaining > 0.005).length };
  },
});

export const completeReconciliation = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    accountCode: v.string(),
    bankAccountId: v.optional(v.id("bankAccounts")),
    periodEnd: v.string(),
    statementClosingBalance: v.number(),
    force: v.optional(v.boolean()),
    adjustmentAccountCode: v.optional(v.string()),
    completedByName: v.optional(v.string()),
    completedBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    let r = await buildReconciliation(ctx, args.orgId, args.accountCode, args.statementClosingBalance);
    let adjustmentJournalId: Id<"journals"> | undefined;

    if (Math.abs(r.difference) > 0.5) {
      if (!args.force) {
        throw new Error(
          `Reconciliation does not balance — difference of KES ${r.difference.toLocaleString("en-KE")}. ` +
            `Match the outstanding items or record an approved adjustment.`
        );
      }
      const offset = args.adjustmentAccountCode || (await resolveControlCode(ctx, args.orgId, "suspense"));
      const diff = r.difference;
      adjustmentJournalId = await postJournalForSource(ctx, {
        orgId: args.orgId,
        source: "bank",
        sourceId: `reconcile-adj:${args.accountCode}:${args.periodEnd}`,
        date: args.periodEnd,
        description: `Reconciliation adjustment for ${args.accountCode}`,
        lines:
          diff > 0
            ? [
                { accountCode: args.accountCode, debit: diff, credit: 0, memo: "Reconciliation adjustment" },
                { accountCode: offset, debit: 0, credit: diff, memo: "Reconciliation adjustment" },
              ]
            : [
                { accountCode: offset, debit: -diff, credit: 0, memo: "Reconciliation adjustment" },
                { accountCode: args.accountCode, debit: 0, credit: -diff, memo: "Reconciliation adjustment" },
              ],
        postedBy: args.completedBy,
        postedByName: args.completedByName ?? "Reconciliation",
      });
      r = await buildReconciliation(ctx, args.orgId, args.accountCode, args.statementClosingBalance);
    }

    // Lock the fully-matched statement lines.
    const lines = await ctx.db
      .query("bankLines")
      .withIndex("by_org_account", (q) => q.eq("orgId", args.orgId).eq("accountCode", args.accountCode))
      .collect();
    for (const l of lines) {
      if (l.status === "reconciled" || l.status === "ignored") continue;
      const matched = await lineMatched(ctx, l._id);
      if (matched >= Math.abs(l.amount) - 0.005) await ctx.db.patch(l._id, { status: "reconciled" });
    }

    const id = await ctx.db.insert("reconciliations", {
      orgId: args.orgId,
      accountCode: args.accountCode,
      bankAccountId: args.bankAccountId,
      periodEnd: args.periodEnd,
      statementClosingBalance: round2(args.statementClosingBalance),
      bookBalance: r.bookBalance,
      outstandingDeposits: r.totals.uncreditedDeposits,
      outstandingPayments: r.totals.unpresentedCheques,
      adjustedBalance: r.adjustedBook,
      difference: r.difference,
      status: "completed",
      adjustmentJournalId,
      completedBy: args.completedBy,
      completedByName: args.completedByName,
      createdAt: tsNow(),
      completedAt: tsNow(),
    });
    return { id, summary: r };
  },
});

export const listReconciliations = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("reconciliations").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

export const dashboard = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const accounts = await ctx.db.query("ledgerAccounts").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const bankAccounts = await ctx.db.query("bankAccounts").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const codeToKind = new Map(bankAccounts.map((b) => [b.accountCode, b.kind]));

    let totalCash = 0;
    let totalBank = 0;
    let totalMpesa = 0;
    const parts = [];
    for (const a of accounts) {
      if (!a.isCash) continue;
      const bal = await ledgerBalance(ctx, args.orgId, a.code);
      const kind = codeToKind.get(a.code);
      if (kind === "mpesa") totalMpesa += bal;
      else if (kind === "bank") totalBank += bal;
      else totalCash += bal;
      parts.push({ code: a.code, name: a.name, kind: kind ?? (a.control === "bank" ? "bank" : "cash"), balance: bal });
    }

    const lines = await ctx.db.query("bankLines").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    let unreconciled = 0;
    for (const l of lines) {
      if (l.status === "reconciled" || l.status === "ignored") continue;
      const matched = await lineMatched(ctx, l._id);
      if (matched < Math.abs(l.amount) - 0.005) unreconciled += 1;
    }

    const recs = await ctx.db.query("reconciliations").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const last = recs.sort((a, b) => b.createdAt - a.createdAt)[0];

    // Cash movement this calendar month (from journals on cash accounts).
    const month = new Date().toISOString().slice(0, 7);
    const journals = await ctx.db.query("journals").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const cashCodes = new Set(accounts.filter((a) => a.isCash).map((a) => a.code));
    let cashIn = 0;
    let cashOut = 0;
    for (const j of journals) {
      if (!j.period || j.period !== month) continue;
      for (const l of j.lines) {
        if (!cashCodes.has(l.accountCode)) continue;
        cashIn += l.debit;
        cashOut += l.credit;
      }
    }

    return {
      totalCash: round2(totalCash),
      totalBank: round2(totalBank),
      totalMpesa: round2(totalMpesa),
      total: round2(totalCash + totalBank + totalMpesa),
      parts,
      unreconciled,
      lastReconciliation: last
        ? { periodEnd: last.periodEnd, accountCode: last.accountCode, completedAt: last.completedAt ?? null, difference: last.difference }
        : null,
      movement: { month, cashIn: round2(cashIn), cashOut: round2(cashOut) },
    };
  },
});
