import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, tsNow } from "./lib";

const DAY = 86_400_000;

/**
 * Invoices that are overdue and due for a payment reminder across all (or one)
 * organization(s). Read-only; the caller sends the messages and then calls
 * `recordReminder`.
 */
export const dueForReminder = query({
  args: { secret: v.string(), now: v.number(), orgId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const today = new Date(args.now).toISOString().slice(0, 10);

    const organizations = args.orgId
      ? [await ctx.db.get(args.orgId)]
      : await ctx.db.query("organizations").collect();

    const out: Array<{
      invoiceId: string;
      orgId: string;
      orgName: string;
      number: string;
      issueDate: string;
      dueDate: string;
      total: number;
      daysOverdue: number;
      remCount: number;
      contactName: string;
      contactCompany: string | null;
      contactPhone: string | null;
      contactEmail: string | null;
      paymentDetails: string | null;
    }> = [];

    for (const org of organizations) {
      if (!org || !org.active) continue;
      if (org.remindersEnabled === false) continue;
      const intervalDays = org.reminderIntervalDays ?? 3;
      const max = org.reminderMax ?? 4;

      const invoices = await ctx.db
        .query("invoices")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .collect();

      for (const inv of invoices) {
        if (inv.status !== "sent" && inv.status !== "overdue") continue;
        if (!inv.dueDate || inv.dueDate >= today) continue; // not overdue yet
        const count = inv.remCount ?? 0;
        if (count >= max) continue;
        if (inv.remLastAt && args.now - inv.remLastAt < intervalDays * DAY) continue;

        const contact = await ctx.db.get(inv.contactId);
        out.push({
          invoiceId: inv._id,
          orgId: org._id,
          orgName: org.name,
          number: inv.number,
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          total: inv.total,
          daysOverdue: Math.max(
            0,
            Math.floor((args.now - new Date(inv.dueDate + "T00:00:00").getTime()) / DAY)
          ),
          remCount: count,
          contactName: contact?.name ?? "Customer",
          contactCompany: contact?.company ?? null,
          contactPhone: contact?.phone ?? null,
          contactEmail: contact?.email ?? null,
          paymentDetails: inv.paymentDetails ?? org.paymentDetails ?? null,
        });
      }
    }
    return out;
  },
});

/** Record that a reminder was sent (and flag the invoice overdue). */
export const recordReminder = mutation({
  args: { secret: v.string(), invoiceId: v.id("invoices"), markOverdue: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const inv = await ctx.db.get(args.invoiceId);
    if (!inv) return false;
    const patch: Record<string, unknown> = {
      remLastAt: tsNow(),
      remCount: (inv.remCount ?? 0) + 1,
      updatedAt: tsNow(),
    };
    if (args.markOverdue && inv.status === "sent") patch.status = "overdue";
    await ctx.db.patch(inv._id, patch);
    return true;
  },
});
