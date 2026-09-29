import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, requireOrg, tsNow } from "./lib";
import { kenyaHolidays } from "./keHolidays";

function fmtTime(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

/** Public holidays for the org (used to exclude non-working days from leave). */
export const listHolidays = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const rows = await ctx.db.query("holidays").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    return [...rows]
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .map((h) => ({ id: h._id, date: h.date, name: h.name, created_at: fmtTime(h.createdAt) }));
  },
});

/** Add (or update) a public holiday. One entry per date. */
export const addHoliday = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    date: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error("Invalid date");
    const name = args.name.trim();
    if (!name) throw new Error("Holiday name is required");

    const existing = await ctx.db
      .query("holidays")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const same = existing.find((h) => h.date === args.date);
    if (same) {
      await ctx.db.patch(same._id, { name });
      return { id: same._id, updated: true };
    }
    const id = await ctx.db.insert("holidays", {
      orgId: args.orgId,
      date: args.date,
      name,
      createdAt: tsNow(),
    });
    return { id, updated: false };
  },
});

export const deleteHoliday = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("holidays") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const row = await ctx.db.get(args.id);
    if (!row || row.orgId !== args.orgId) throw new Error("Holiday not found");
    await ctx.db.delete(args.id);
    return { deleted: true };
  },
});

/**
 * Auto-generate Kenya's public holidays for a year (fixed + Easter + Eid) and
 * upsert them. Safe to re-run; existing entries keep any manual renaming.
 */
export const generateHolidays = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), year: v.number() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireOrg(ctx, args.orgId);
    if (!Number.isInteger(args.year) || args.year < 2000 || args.year > 2100) {
      throw new Error("Invalid year");
    }
    const list = kenyaHolidays(args.year);
    const existing = await ctx.db
      .query("holidays")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const byDate = new Map(existing.map((h) => [h.date, h]));
    let added = 0;
    for (const h of list) {
      if (byDate.has(h.date)) continue;
      await ctx.db.insert("holidays", { orgId: args.orgId, date: h.date, name: h.name, createdAt: tsNow() });
      added += 1;
    }
    return { added, total: list.length };
  },
});
