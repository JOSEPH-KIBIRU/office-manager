import { query, mutation, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { assertSecret, tsNow } from "./lib";
import { roundKes } from "./accounting";

/**
 * Management accounting: cost centres, projects, budgets and dimension-based
 * reporting. All reports derive from the General Ledger journal lines and their
 * optional `costCenterCode` / `projectId` tags — no balances are duplicated.
 */

type AccountInfo = { name: string; type: string };
type Dim = "cost_centre" | "project";

async function loadAccounts(ctx: QueryCtx | MutationCtx, orgId: Id<"organizations">) {
  const rows = await ctx.db.query("ledgerAccounts").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
  const map = new Map<string, AccountInfo>();
  for (const a of rows) map.set(a.code, { name: a.name, type: a.type });
  return map;
}

async function loadJournals(ctx: QueryCtx | MutationCtx, orgId: Id<"organizations">) {
  return ctx.db.query("journals").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
}

function isIncome(type: string) {
  return type === "income";
}
function isCost(type: string) {
  return type === "expense" || type === "cost_of_sales";
}

/* ------------------------------------------------------------------ *
 * Cost centres
 * ------------------------------------------------------------------ */

export const listCostCentres = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("costCentres").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    return rows.sort((a, b) => a.code.localeCompare(b.code));
  },
});

export const createCostCentre = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    name: v.string(),
    type: v.union(v.literal("branch"), v.literal("department"), v.literal("location"), v.literal("cost_centre")),
    code: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const name = args.name.trim();
    if (!name) throw new Error("Name is required");
    const rows = await ctx.db.query("costCentres").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const prefix = args.type === "branch" ? "BR" : args.type === "department" ? "DEP" : args.type === "location" ? "LOC" : "CC";
    const code = (args.code?.trim() || `${prefix}-${String(rows.length + 1).padStart(3, "0")}`).toUpperCase();
    if (rows.some((r) => r.code === code)) throw new Error(`Code ${code} already exists`);
    const id = await ctx.db.insert("costCentres", {
      orgId: args.orgId,
      code,
      name,
      type: args.type,
      active: true,
      createdBy: args.createdBy,
      createdAt: tsNow(),
      updatedAt: tsNow(),
    });
    return { id, code };
  },
});

export const updateCostCentre = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("costCentres"),
    name: v.optional(v.string()),
    type: v.optional(v.union(v.literal("branch"), v.literal("department"), v.literal("location"), v.literal("cost_centre"))),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Cost centre not found");
    const patch: Record<string, unknown> = { updatedAt: tsNow() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.type !== undefined) patch.type = args.type;
    if (args.active !== undefined) patch.active = args.active;
    await ctx.db.patch(args.id, patch);
    return true;
  },
});

/* ------------------------------------------------------------------ *
 * Projects
 * ------------------------------------------------------------------ */

export const listProjects = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("projects").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const out = [];
    for (const p of rows.sort((a, b) => a.code.localeCompare(b.code))) {
      const customer = p.customerId ? await ctx.db.get(p.customerId) : null;
      out.push({ ...p, customerName: customer?.name ?? null });
    }
    return out;
  },
});

export const createProject = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    name: v.string(),
    customerId: v.optional(v.id("contacts")),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    budget: v.optional(v.number()),
    code: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const name = args.name.trim();
    if (!name) throw new Error("Project name is required");
    const rows = await ctx.db.query("projects").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const code = (args.code?.trim() || `PRJ-${String(rows.length + 1).padStart(3, "0")}`).toUpperCase();
    if (rows.some((r) => r.code === code)) throw new Error(`Project code ${code} already exists`);
    const id = await ctx.db.insert("projects", {
      orgId: args.orgId,
      code,
      name,
      customerId: args.customerId,
      startDate: args.startDate || undefined,
      endDate: args.endDate || undefined,
      budget: roundKes(args.budget ?? 0),
      status: "active",
      active: true,
      createdBy: args.createdBy,
      createdAt: tsNow(),
      updatedAt: tsNow(),
    });
    return { id, code };
  },
});

export const updateProject = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("projects"),
    name: v.optional(v.string()),
    customerId: v.optional(v.union(v.id("contacts"), v.null())),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    budget: v.optional(v.number()),
    status: v.optional(v.union(v.literal("draft"), v.literal("active"), v.literal("on_hold"), v.literal("completed"))),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Project not found");
    const patch: Record<string, unknown> = { updatedAt: tsNow() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.customerId !== undefined) patch.customerId = args.customerId ?? undefined;
    if (args.startDate !== undefined) patch.startDate = args.startDate || undefined;
    if (args.endDate !== undefined) patch.endDate = args.endDate || undefined;
    if (args.budget !== undefined) patch.budget = roundKes(args.budget);
    if (args.status !== undefined) patch.status = args.status;
    if (args.active !== undefined) patch.active = args.active;
    await ctx.db.patch(args.id, patch);
    return true;
  },
});

/* ------------------------------------------------------------------ *
 * Budgets
 * ------------------------------------------------------------------ */

export const listBudgets = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("budgets").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const accounts = await loadAccounts(ctx, args.orgId);
    return rows
      .sort((a, b) => (a.period === b.period ? a.accountCode.localeCompare(b.accountCode) : b.period.localeCompare(a.period)))
      .map((b) => ({ ...b, accountName: accounts.get(b.accountCode)?.name ?? b.accountCode }));
  },
});

export const upsertBudget = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    period: v.string(),
    frequency: v.union(v.literal("annual"), v.literal("monthly")),
    accountCode: v.string(),
    costCenterCode: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    amount: v.number(),
    note: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    if (args.frequency === "annual" && !/^\d{4}$/.test(args.period)) throw new Error("Annual period must be YYYY");
    if (args.frequency === "monthly" && !/^\d{4}-\d{2}$/.test(args.period)) throw new Error("Monthly period must be YYYY-MM");
    const rows = await ctx.db.query("budgets").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const existing = rows.find(
      (b) =>
        b.period === args.period &&
        b.accountCode === args.accountCode &&
        (b.costCenterCode ?? "") === (args.costCenterCode ?? "") &&
        (b.projectId ?? "") === (args.projectId ?? "")
    );
    if (existing) {
      await ctx.db.patch(existing._id, { amount: roundKes(args.amount), frequency: args.frequency, note: args.note?.trim() || undefined, updatedAt: tsNow() });
      return { id: existing._id };
    }
    const id = await ctx.db.insert("budgets", {
      orgId: args.orgId,
      period: args.period,
      frequency: args.frequency,
      accountCode: args.accountCode,
      costCenterCode: args.costCenterCode || undefined,
      projectId: args.projectId,
      amount: roundKes(args.amount),
      note: args.note?.trim() || undefined,
      createdBy: args.createdBy,
      createdAt: tsNow(),
      updatedAt: tsNow(),
    });
    return { id };
  },
});

export const deleteBudget = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("budgets") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) throw new Error("Budget not found");
    await ctx.db.delete(args.id);
    return true;
  },
});

/* ------------------------------------------------------------------ *
 * Dimension requirements (per account)
 * ------------------------------------------------------------------ */

export const listDimensionRequirements = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("dimensionRequirements").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const accounts = await loadAccounts(ctx, args.orgId);
    return rows.map((r) => ({ ...r, accountName: accounts.get(r.accountCode)?.name ?? r.accountCode }));
  },
});

export const setDimensionRequirement = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    accountCode: v.string(),
    requireCostCentre: v.boolean(),
    requireProject: v.boolean(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const existing = await ctx.db
      .query("dimensionRequirements")
      .withIndex("by_org_account", (q) => q.eq("orgId", args.orgId).eq("accountCode", args.accountCode))
      .first();
    if (!args.requireCostCentre && !args.requireProject) {
      if (existing) await ctx.db.delete(existing._id);
      return { removed: true };
    }
    if (existing) {
      await ctx.db.patch(existing._id, {
        requireCostCentre: args.requireCostCentre,
        requireProject: args.requireProject,
        updatedAt: tsNow(),
      });
    } else {
      await ctx.db.insert("dimensionRequirements", {
        orgId: args.orgId,
        accountCode: args.accountCode,
        requireCostCentre: args.requireCostCentre,
        requireProject: args.requireProject,
        createdAt: tsNow(),
        updatedAt: tsNow(),
      });
    }
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ *
 * Reporting (derived from the General Ledger)
 * ------------------------------------------------------------------ */

export const pnlByDimension = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    dimension: v.union(v.literal("cost_centre"), v.literal("project")),
    from: v.string(),
    through: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const accounts = await loadAccounts(ctx, args.orgId);
    const journals = await loadJournals(ctx, args.orgId);
    const costCentres = await ctx.db.query("costCentres").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const projects = await ctx.db.query("projects").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const ccName = new Map(costCentres.map((c) => [c.code, c.name]));
    const prjName = new Map(projects.map((p) => [p._id as string, p.name]));

    const map = new Map<string, { key: string; label: string; revenue: number; cost: number }>();
    for (const j of journals) {
      if (j.reversedBy) continue;
      if (j.date < args.from || j.date > args.through) continue;
      for (const l of j.lines) {
        const key = args.dimension === "cost_centre" ? (l.costCenterCode ?? "(unassigned)") : ((l.projectId as string) ?? "(unassigned)");
        const label =
          key === "(unassigned)"
            ? "(unassigned)"
            : args.dimension === "cost_centre"
              ? ccName.get(key) ?? key
              : prjName.get(key) ?? key;
        const info = accounts.get(l.accountCode);
        if (!info) continue;
        const cur = map.get(key) ?? { key, label, revenue: 0, cost: 0 };
        if (isIncome(info.type)) cur.revenue += l.credit - l.debit;
        else if (isCost(info.type)) cur.cost += l.debit - l.credit;
        map.set(key, cur);
      }
    }
    const rows = [...map.values()]
      .map((r) => ({ ...r, revenue: roundKes(r.revenue), cost: roundKes(r.cost), profit: roundKes(r.revenue - r.cost) }))
      .sort((a, b) => b.profit - a.profit);
    const totals = rows.reduce((a, r) => ({ revenue: a.revenue + r.revenue, cost: a.cost + r.cost, profit: a.profit + r.profit }), { revenue: 0, cost: 0, profit: 0 });
    return { dimension: args.dimension, from: args.from, through: args.through, rows, totals };
  },
});

function budgetOverlaps(period: string, from: string, through: string): boolean {
  if (/^\d{4}$/.test(period)) {
    const y = Number(period);
    return y >= Number(from.slice(0, 4)) && y <= Number(through.slice(0, 4));
  }
  return period >= from.slice(0, 7) && period <= through.slice(0, 7);
}

export const budgetVsActual = query({
  args: { secret: v.string(), orgId: v.id("organizations"), from: v.string(), through: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const accounts = await loadAccounts(ctx, args.orgId);
    const journals = await loadJournals(ctx, args.orgId);
    const budgets = await ctx.db.query("budgets").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const costCentres = await ctx.db.query("costCentres").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const projects = await ctx.db.query("projects").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const ccName = new Map(costCentres.map((c) => [c.code, c.name]));
    const prjName = new Map(projects.map((p) => [p._id as string, p.name]));

    const activeBudgets = budgets.filter((b) => budgetOverlaps(b.period, args.from, args.through));
    const rows = activeBudgets.map((b) => {
      let actual = 0;
      for (const j of journals) {
        if (j.reversedBy || j.date < args.from || j.date > args.through) continue;
        for (const l of j.lines) {
          if (l.accountCode !== b.accountCode) continue;
          if (b.costCenterCode && l.costCenterCode !== b.costCenterCode) continue;
          if (b.projectId && l.projectId !== b.projectId) continue;
          const info = accounts.get(l.accountCode);
          if (!info) continue;
          if (isIncome(info.type)) actual += l.credit - l.debit;
          else if (isCost(info.type)) actual += l.debit - l.credit;
        }
      }
      actual = roundKes(actual);
      const variance = roundKes(b.amount - actual);
      return {
        id: b._id,
        period: b.period,
        frequency: b.frequency,
        accountCode: b.accountCode,
        accountName: accounts.get(b.accountCode)?.name ?? b.accountCode,
        dimension:
          b.projectId ? `Project: ${prjName.get(b.projectId as string) ?? b.projectId}`
          : b.costCenterCode ? `Cost centre: ${ccName.get(b.costCenterCode) ?? b.costCenterCode}`
          : "Company-wide",
        budget: b.amount,
        actual,
        variance,
        variancePct: b.amount !== 0 ? Math.round((variance / b.amount) * 1000) / 10 : null,
      };
    });
    const totals = rows.reduce((a, r) => ({ budget: a.budget + r.budget, actual: a.actual + r.actual, variance: a.variance + r.variance }), { budget: 0, actual: 0, variance: 0 });
    return { from: args.from, through: args.through, rows, totals };
  },
});

export const projectProfitability = query({
  args: { secret: v.string(), orgId: v.id("organizations"), from: v.string(), through: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const accounts = await loadAccounts(ctx, args.orgId);
    const journals = await loadJournals(ctx, args.orgId);
    const projects = await ctx.db.query("projects").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const map = new Map<string, { revenue: number; cost: number }>();
    for (const j of journals) {
      if (j.reversedBy || j.date < args.from || j.date > args.through) continue;
      for (const l of j.lines) {
        if (!l.projectId) continue;
        const info = accounts.get(l.accountCode);
        if (!info) continue;
        const cur = map.get(l.projectId as string) ?? { revenue: 0, cost: 0 };
        if (isIncome(info.type)) cur.revenue += l.credit - l.debit;
        else if (isCost(info.type)) cur.cost += l.debit - l.credit;
        map.set(l.projectId as string, cur);
      }
    }
    const rows = [];
    for (const p of projects.sort((a, b) => a.code.localeCompare(b.code))) {
      const agg = map.get(p._id as string) ?? { revenue: 0, cost: 0 };
      const revenue = roundKes(agg.revenue);
      const directCosts = roundKes(agg.cost);
      const grossProfit = roundKes(revenue - directCosts);
      const customer = p.customerId ? await ctx.db.get(p.customerId) : null;
      rows.push({
        id: p._id,
        code: p.code,
        name: p.name,
        customerName: customer?.name ?? null,
        status: p.status,
        budget: p.budget,
        revenue,
        directCosts,
        grossProfit,
        grossMargin: revenue !== 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : null,
      });
    }
    const totals = rows.reduce((a, r) => ({ revenue: a.revenue + r.revenue, directCosts: a.directCosts + r.directCosts, grossProfit: a.grossProfit + r.grossProfit }), { revenue: 0, directCosts: 0, grossProfit: 0 });
    return { from: args.from, through: args.through, rows, totals };
  },
});
