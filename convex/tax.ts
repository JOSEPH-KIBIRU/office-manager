import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { assertSecret, tsNow } from "./lib";
import { resolveControlCode, roundKes } from "./accounting";

/**
 * Centralised tax configuration and tax reporting.
 *
 * Tax rates live in `taxConfigs` (never hard-coded). All tax reports derive from
 * the General Ledger journal lines — no separate tax balances exist.
 */

/** Suggested baseline configs for a new company (rates as of the effective date). */
export const DEFAULT_TAXES: Array<{
  code: string;
  name: string;
  rate: number;
  effectiveDate: string;
  inputAccountCode?: string;
  outputAccountCode?: string;
  liabilityAccountCode?: string;
}> = [
  { code: "VAT_16", name: "VAT (standard)", rate: 16, effectiveDate: "2016-01-01", inputAccountCode: "1150", outputAccountCode: "2150" },
  { code: "VAT_8", name: "VAT (reduced)", rate: 8, effectiveDate: "2020-01-01", inputAccountCode: "1150", outputAccountCode: "2150" },
  { code: "VAT_ZERO", name: "VAT (zero-rated)", rate: 0, effectiveDate: "2016-01-01", inputAccountCode: "1150", outputAccountCode: "2150" },
  { code: "PAYE", name: "PAYE", rate: 0, effectiveDate: "2016-01-01", liabilityAccountCode: "2100" },
  { code: "NSSF", name: "NSSF", rate: 6, effectiveDate: "2025-02-01", liabilityAccountCode: "2110" },
  { code: "SHIF", name: "SHIF", rate: 2.75, effectiveDate: "2024-10-01", liabilityAccountCode: "2120" },
  { code: "HOUSING", name: "Housing Levy", rate: 1.5, effectiveDate: "2021-01-01", liabilityAccountCode: "2130" },
  { code: "HELB", name: "HELB", rate: 0, effectiveDate: "2016-01-01", liabilityAccountCode: "2160" },
  { code: "WHT", name: "Withholding Tax", rate: 5, effectiveDate: "2016-01-01", liabilityAccountCode: "2190" },
];

export const listTaxConfigs = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("taxConfigs").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    return rows.sort((a, b) => a.code.localeCompare(b.code));
  },
});

export const upsertTaxConfig = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    code: v.string(),
    name: v.string(),
    rate: v.number(),
    effectiveDate: v.string(),
    inputAccountCode: v.optional(v.string()),
    outputAccountCode: v.optional(v.string()),
    liabilityAccountCode: v.optional(v.string()),
    active: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const code = args.code.trim().toUpperCase();
    if (!code) throw new Error("A tax code is required");
    if (!args.name.trim()) throw new Error("A name is required");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.effectiveDate)) throw new Error("A valid effective date is required");
    const existing = await ctx.db
      .query("taxConfigs")
      .withIndex("by_org_code", (q) => q.eq("orgId", args.orgId).eq("code", code))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name.trim(),
        rate: args.rate,
        effectiveDate: args.effectiveDate,
        inputAccountCode: args.inputAccountCode || undefined,
        outputAccountCode: args.outputAccountCode || undefined,
        liabilityAccountCode: args.liabilityAccountCode || undefined,
        active: args.active ?? existing.active,
        notes: args.notes?.trim() || undefined,
        updatedAt: tsNow(),
      });
      return { id: existing._id, code };
    }
    const id = await ctx.db.insert("taxConfigs", {
      orgId: args.orgId,
      code,
      name: args.name.trim(),
      rate: args.rate,
      effectiveDate: args.effectiveDate,
      inputAccountCode: args.inputAccountCode || undefined,
      outputAccountCode: args.outputAccountCode || undefined,
      liabilityAccountCode: args.liabilityAccountCode || undefined,
      active: args.active ?? true,
      notes: args.notes?.trim() || undefined,
      createdBy: args.createdBy,
      createdAt: tsNow(),
      updatedAt: tsNow(),
    });
    return { id, code };
  },
});

export const setTaxConfigActive = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), code: v.string(), active: v.boolean() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db
      .query("taxConfigs")
      .withIndex("by_org_code", (q) => q.eq("orgId", args.orgId).eq("code", args.code.toUpperCase()))
      .first();
    if (!doc) throw new Error("Tax config not found");
    await ctx.db.patch(doc._id, { active: args.active, updatedAt: tsNow() });
    return true;
  },
});

/** Load the default tax codes for a company that has none yet. */
export const seedDefaultTaxes = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), createdBy: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("taxConfigs").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const have = new Set(rows.map((r) => r.code));
    let added = 0;
    for (const t of DEFAULT_TAXES) {
      if (have.has(t.code)) continue;
      await ctx.db.insert("taxConfigs", {
        orgId: args.orgId,
        code: t.code,
        name: t.name,
        rate: t.rate,
        effectiveDate: t.effectiveDate,
        inputAccountCode: t.inputAccountCode,
        outputAccountCode: t.outputAccountCode,
        liabilityAccountCode: t.liabilityAccountCode,
        active: true,
        createdBy: args.createdBy,
        createdAt: tsNow(),
        updatedAt: tsNow(),
      });
      added += 1;
    }
    return { added };
  },
});

/**
 * VAT report derived entirely from the ledger:
 * taxable sales/purchases from revenue/expense lines, output/input VAT from the
 * VAT control accounts, net VAT payable = output − input.
 */
export const vatReport = query({
  args: { secret: v.string(), orgId: v.id("organizations"), from: v.string(), through: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const accounts = await ctx.db.query("ledgerAccounts").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const typeOf = new Map(accounts.map((a) => [a.code, a.type as string]));
    const vatOut = await resolveControlCode(ctx, args.orgId, "vat_output");
    const vatIn = await resolveControlCode(ctx, args.orgId, "vat_input");

    const journals = await ctx.db.query("journals").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    let taxableSales = 0;
    let taxablePurchases = 0;
    let outputVat = 0;
    let inputVat = 0;
    let adjustments = 0;
    for (const j of journals) {
      if (j.date < args.from || j.date > args.through) continue;
      for (const l of j.lines) {
        if (l.accountCode === vatOut) {
          outputVat += l.credit - l.debit;
          // Any output VAT movement that is not from revenue is an adjustment.
          if (j.source === "vat" || j.source === "manual") adjustments += l.credit - l.debit;
          continue;
        }
        if (l.accountCode === vatIn) {
          inputVat += l.debit - l.credit;
          if (j.source === "vat" || j.source === "manual") adjustments -= l.debit - l.credit;
          continue;
        }
        const t = typeOf.get(l.accountCode);
        if (t === "income") taxableSales += l.credit - l.debit;
        else if (t === "expense" || t === "cost_of_sales") taxablePurchases += l.debit - l.credit;
      }
    }
    outputVat = roundKes(outputVat);
    inputVat = roundKes(inputVat);
    const netVatPayable = roundKes(outputVat - inputVat + adjustments);
    return {
      from: args.from,
      through: args.through,
      taxableSales: roundKes(taxableSales),
      outputVat,
      taxablePurchases: roundKes(taxablePurchases),
      inputVat,
      adjustments: roundKes(adjustments),
      netVatPayable,
      vatOutputAccount: vatOut,
      vatInputAccount: vatIn,
    };
  },
});

/** Statutory tax liabilities (PAYE/NSSF/SHIF/Housing/HELB/WHT…) from the GL. */
export const taxSummary = query({
  args: { secret: v.string(), orgId: v.id("organizations"), from: v.string(), through: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const accounts = await ctx.db.query("ledgerAccounts").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const statutory = accounts.filter((a) => a.statutory || a.type === "liability");
    const journals = await ctx.db.query("journals").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const rows = [];
    for (const a of statutory) {
      let amount = 0;
      for (const j of journals) {
        if (j.date < args.from || j.date > args.through) continue;
        for (const l of j.lines) {
          if (l.accountCode !== a.code) continue;
          amount += a.type === "asset" ? l.debit - l.credit : l.credit - l.debit;
        }
      }
      amount = roundKes(amount);
      if (amount !== 0) rows.push({ code: a.code, name: a.name, amount });
    }
    const total = roundKes(rows.reduce((s, r) => s + r.amount, 0));
    return { from: args.from, through: args.through, rows: rows.sort((a, b) => a.code.localeCompare(b.code)), total };
  },
});
