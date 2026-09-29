import { query } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret } from "./lib";

/**
 * Lightweight "getting started" signals for the dashboard checklist. Returns
 * counts only — never the underlying records.
 */
export const status = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const org = await ctx.db.get(args.orgId);
    if (!org) return null;

    const users = await ctx.db.query("users").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const departments = await ctx.db.query("departments").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const payrolls = await ctx.db.query("payrolls").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();
    const invoices = await ctx.db.query("invoices").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect();

    return {
      branding: !!(org.logoFileId || (org.address && org.address.trim()) || (org.phone && org.phone.trim())),
      team: users.filter((u) => u.role !== "super_admin").length,
      departments: departments.length,
      payrolls: payrolls.length,
      invoices: invoices.length,
    };
  },
});
