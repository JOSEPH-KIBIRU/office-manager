import { query, mutation, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { assertSecret, tsNow } from "./lib";
import { postJournalForSource, resolveControlCode, roundKes } from "./accounting";

/**
 * Fixed-asset register. Purchases and depreciation post through the journal
 * engine; depreciation is idempotent per asset per period and is never
 * overwritten (each period posts its own entry).
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

function monthsBetween(from: string, to: string): number {
  const f = new Date(from + "T00:00:00Z");
  const t = new Date(to + "T00:00:00Z");
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return 0;
  return (t.getUTCFullYear() - f.getUTCFullYear()) * 12 + (t.getUTCMonth() - f.getUTCMonth()) + 1;
}

async function nextTag(ctx: MutationCtx, orgId: Id<"organizations">): Promise<string> {
  const rows = await ctx.db.query("fixedAssets").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  return `FA-${String(rows.length + 1).padStart(4, "0")}`;
}

async function enrich(ctx: QueryCtx, a: any) {
  const nbv = round2(a.purchaseCost - a.accumulatedDepreciation);
  const supplier = a.supplierId ? await ctx.db.get(a.supplierId as Id<"contacts">) : null;
  return {
    id: a._id,
    tag: a.tag,
    name: a.name,
    category: a.category ?? null,
    purchaseDate: a.purchaseDate,
    purchaseCost: a.purchaseCost,
    supplierId: a.supplierId ?? null,
    supplierName: supplier?.name ?? null,
    location: a.location ?? null,
    custodian: a.custodian ?? null,
    usefulLifeYears: a.usefulLifeYears,
    depreciationMethod: a.depreciationMethod,
    residualValue: a.residualValue,
    accumulatedDepreciation: a.accumulatedDepreciation,
    netBookValue: nbv,
    status: a.status,
    assetAccountCode: a.assetAccountCode,
    accumDepAccountCode: a.accumDepAccountCode,
    depExpenseAccountCode: a.depExpenseAccountCode,
    disposedDate: a.disposedDate ?? null,
    disposalProceeds: a.disposalProceeds ?? null,
  };
}

export const listFixedAssets = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("fixedAssets").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const out = [];
    for (const a of rows.sort((x, y) => y.createdAt - x.createdAt)) out.push(await enrich(ctx, a));
    return out;
  },
});

export const createFixedAsset = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    name: v.string(),
    category: v.optional(v.string()),
    purchaseDate: v.string(),
    purchaseCost: v.number(),
    supplierId: v.optional(v.id("contacts")),
    location: v.optional(v.string()),
    custodian: v.optional(v.string()),
    usefulLifeYears: v.number(),
    residualValue: v.optional(v.number()),
    assetAccountCode: v.optional(v.string()),
    accumDepAccountCode: v.optional(v.string()),
    depExpenseAccountCode: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    if (!args.name.trim()) throw new Error("Asset name is required");
    if (!(args.purchaseCost > 0)) throw new Error("Purchase cost must be greater than zero");
    if (!(args.usefulLifeYears > 0)) throw new Error("Useful life must be greater than zero");
    const tag = await nextTag(ctx, args.orgId);
    const id = await ctx.db.insert("fixedAssets", {
      orgId: args.orgId,
      tag,
      name: args.name.trim(),
      category: args.category?.trim() || undefined,
      purchaseDate: args.purchaseDate,
      purchaseCost: round2(args.purchaseCost),
      supplierId: args.supplierId,
      location: args.location?.trim() || undefined,
      custodian: args.custodian?.trim() || undefined,
      usefulLifeYears: args.usefulLifeYears,
      depreciationMethod: "straight_line",
      residualValue: round2(args.residualValue ?? 0),
      accumulatedDepreciation: 0,
      status: "draft",
      assetAccountCode: args.assetAccountCode || "1220",
      accumDepAccountCode: args.accumDepAccountCode || "1250",
      depExpenseAccountCode: args.depExpenseAccountCode || "5300",
      createdBy: args.createdBy,
      createdAt: tsNow(),
      updatedAt: tsNow(),
    });
    return { id, tag };
  },
});

export const updateFixedAsset = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("fixedAssets"),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    location: v.optional(v.string()),
    custodian: v.optional(v.string()),
    usefulLifeYears: v.optional(v.number()),
    residualValue: v.optional(v.number()),
    assetAccountCode: v.optional(v.string()),
    accumDepAccountCode: v.optional(v.string()),
    depExpenseAccountCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Asset not found");
    const patch: Record<string, unknown> = { updatedAt: tsNow() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.category !== undefined) patch.category = args.category?.trim() || undefined;
    if (args.location !== undefined) patch.location = args.location?.trim() || undefined;
    if (args.custodian !== undefined) patch.custodian = args.custodian?.trim() || undefined;
    if (args.usefulLifeYears !== undefined) patch.usefulLifeYears = args.usefulLifeYears;
    if (args.residualValue !== undefined) patch.residualValue = round2(args.residualValue);
    if (args.assetAccountCode !== undefined) patch.assetAccountCode = args.assetAccountCode;
    if (args.accumDepAccountCode !== undefined) patch.accumDepAccountCode = args.accumDepAccountCode;
    if (args.depExpenseAccountCode !== undefined) patch.depExpenseAccountCode = args.depExpenseAccountCode;
    await ctx.db.patch(args.id, patch);
    return true;
  },
});

export const setFixedAssetStatus = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("fixedAssets"),
    status: v.union(
      v.literal("draft"),
      v.literal("purchased"),
      v.literal("active"),
      v.literal("disposed"),
      v.literal("archived")
    ),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Asset not found");
    if (doc.status === "disposed" && args.status !== "disposed") throw new Error("Disposed assets cannot be reactivated.");
    await ctx.db.patch(args.id, { status: args.status, updatedAt: tsNow() });
    return true;
  },
});

/** Capitalise a purchased asset: Dr Fixed asset (+ Input VAT), Cr AP/Bank. */
export const capitaliseAsset = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("fixedAssets"),
    date: v.optional(v.string()),
    payFrom: v.optional(v.union(v.literal("ap"), v.literal("bank"), v.literal("cash"))),
    vatRate: v.optional(v.number()),
    createdByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const asset = await ctx.db.get(args.id);
    if (!asset || asset.orgId !== args.orgId) throw new Error("Asset not found");
    if (asset.status !== "draft") throw new Error("Only draft assets can be capitalised.");
    const date = args.date || asset.purchaseDate;
    const rate = Math.max(0, Math.min(100, args.vatRate ?? 0));
    const cost = asset.purchaseCost;
    const vat = rate > 0 ? round2(cost - cost / (1 + rate / 100)) : 0;
    const net = round2(cost - vat);
    const creditCode =
      args.payFrom === "bank"
        ? await resolveControlCode(ctx, args.orgId, "bank")
        : args.payFrom === "cash"
          ? await resolveControlCode(ctx, args.orgId, "cash")
          : await resolveControlCode(ctx, args.orgId, "ap");
    const vatIn = await resolveControlCode(ctx, args.orgId, "vat_input");

    const lines =
      vat > 0
        ? [
            { accountCode: asset.assetAccountCode, debit: net, credit: 0, memo: asset.tag },
            { accountCode: vatIn, debit: vat, credit: 0, memo: "Input VAT" },
            { accountCode: creditCode, debit: 0, credit: cost, memo: asset.tag },
          ]
        : [
            { accountCode: asset.assetAccountCode, debit: cost, credit: 0, memo: asset.tag },
            { accountCode: creditCode, debit: 0, credit: cost, memo: asset.tag },
          ];

    const journalId = await postJournalForSource(ctx, {
      orgId: args.orgId,
      source: "asset",
      sourceId: `${asset._id}:purchase`,
      date,
      description: `Asset purchase — ${asset.name}`,
      lines,
      postedByName: args.createdByName ?? "Fixed assets",
    });
    await ctx.db.patch(asset._id, { status: "active", purchaseJournalId: journalId, updatedAt: tsNow() });
    return { journalId };
  },
});

/** Post straight-line depreciation for one period (idempotent per asset per period). */
export const runDepreciation = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    period: v.string(),
    createdByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    if (!/^\d{4}-\d{2}$/.test(args.period)) throw new Error("Period must be YYYY-MM");
    const periodEnd = `${args.period}-${new Date(Date.UTC(Number(args.period.slice(0, 4)), Number(args.period.slice(5, 7)), 0)).getUTCDate()}`;
    const assets = await ctx.db.query("fixedAssets").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    let posted = 0;
    let total = 0;
    const skipped: string[] = [];
    for (const asset of assets) {
      if (asset.status !== "active") continue;
      const elapsed = monthsBetween(asset.purchaseDate, periodEnd);
      const lifeMonths = Math.max(1, Math.round(asset.usefulLifeYears * 12));
      if (elapsed <= 0 || elapsed > lifeMonths) continue;
      const already = await ctx.db
        .query("journals")
        .withIndex("by_source", (q) =>
          q.eq("orgId", args.orgId).eq("source", "depreciation").eq("sourceId", `${asset._id}:${args.period}` as never)
        )
        .first();
      if (already && !already.reversedBy) {
        skipped.push(asset.tag);
        continue;
      }
      const base = round2(asset.purchaseCost - asset.residualValue);
      const target = Math.min(base, round2((base / lifeMonths) * elapsed));
      const needed = round2(target - asset.accumulatedDepreciation);
      if (needed <= 0.005) {
        skipped.push(asset.tag);
        continue;
      }
      await postJournalForSource(ctx, {
        orgId: args.orgId,
        source: "depreciation",
        sourceId: `${asset._id}:${args.period}`,
        date: periodEnd,
        description: `Depreciation ${args.period} — ${asset.name}`,
        lines: [
          { accountCode: asset.depExpenseAccountCode, debit: needed, credit: 0, memo: asset.tag },
          { accountCode: asset.accumDepAccountCode, debit: 0, credit: needed, memo: asset.tag },
        ],
        postedByName: args.createdByName ?? "Depreciation run",
      });
      await ctx.db.patch(asset._id, {
        accumulatedDepreciation: round2(asset.accumulatedDepreciation + needed),
        updatedAt: tsNow(),
      });
      posted += 1;
      total = round2(total + needed);
    }
    return { posted, total, skipped };
  },
});

/** Dispose an asset: clear cost & accumulated depreciation, record proceeds and gain/loss. */
export const disposeAsset = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("fixedAssets"),
    date: v.string(),
    proceeds: v.number(),
    proceedsAccountCode: v.optional(v.string()),
    gainAccountCode: v.optional(v.string()),
    lossAccountCode: v.optional(v.string()),
    createdByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const asset = await ctx.db.get(args.id);
    if (!asset || asset.orgId !== args.orgId) throw new Error("Asset not found");
    if (asset.status === "disposed") throw new Error("Asset already disposed.");
    const accum = round2(asset.accumulatedDepreciation);
    const nbv = round2(asset.purchaseCost - accum);
    const proceeds = round2(args.proceeds);
    const gain = round2(proceeds - nbv);
    const proceedsCode = args.proceedsAccountCode || (await resolveControlCode(ctx, args.orgId, "bank"));

    const lines = [
      { accountCode: asset.accumDepAccountCode, debit: accum, credit: 0, memo: asset.tag },
      ...(proceeds !== 0 ? [{ accountCode: proceedsCode, debit: proceeds, credit: 0, memo: "Disposal proceeds" }] : []),
      { accountCode: asset.assetAccountCode, debit: 0, credit: asset.purchaseCost, memo: asset.tag },
      ...(gain > 0
        ? [{ accountCode: args.gainAccountCode || "4100", debit: 0, credit: gain, memo: "Gain on disposal" }]
        : gain < 0
          ? [{ accountCode: args.lossAccountCode || "5990", debit: -gain, credit: 0, memo: "Loss on disposal" }]
          : []),
    ];

    const journalId = await postJournalForSource(ctx, {
      orgId: args.orgId,
      source: "asset",
      sourceId: `${asset._id}:disposal`,
      date: args.date,
      description: `Disposal — ${asset.name}`,
      lines,
      postedByName: args.createdByName ?? "Fixed assets",
    });
    await ctx.db.patch(asset._id, {
      status: "disposed",
      disposedDate: args.date,
      disposalProceeds: proceeds,
      disposalJournalId: journalId,
      updatedAt: tsNow(),
    });
    return { journalId, originalCost: asset.purchaseCost, accumulated: accum, netBookValue: nbv, proceeds, gain };
  },
});
