import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, tsNow } from "./lib";
import { pushNotification } from "./notifications";

const DAY = 86_400_000;

function weekKey(ms: number): string {
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const day = Math.floor((Date.UTC(year, d.getUTCMonth(), d.getUTCDate()) - start) / DAY);
  return `${year}-W${String(Math.floor(day / 7) + 1).padStart(2, "0")}`;
}

function num(value: number | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Organisation ids for the scheduled automation runner. */
export const listAutomationOrgs = query({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const orgs = await ctx.db.query("organizations").collect();
    return orgs.filter((o) => o.active && !o.deletedAt).map((o) => ({ id: o._id, name: o.name }));
  },
});

export const runForOrg = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    now: v.optional(v.number()),
    staleLeadDays: v.optional(v.number()),
    staleDealDays: v.optional(v.number()),
    slaHours: v.optional(v.number()),
    quoteFollowUpDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const now = args.now ?? tsNow();
    const org = await ctx.db.get(args.orgId);
    if (!org || !org.active || org.deletedAt) {
      return { leads: 0, deals: 0, quotes: 0, notifications: 0 };
    }

    const staleLeadDays = num(args.staleLeadDays, 3, 1, 365);
    const staleDealDays = num(args.staleDealDays, 7, 1, 365);
    const slaHours = num(args.slaHours, 24, 1, 24 * 30);
    const quoteFollowUpDays = num(args.quoteFollowUpDays, 3, 1, 60);

    const [leads, deals, quotes, tasks, users] = await Promise.all([
      ctx.db.query("crmLeads").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect(),
      ctx.db.query("crmDeals").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect(),
      ctx.db.query("crmQuotations").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect(),
      ctx.db.query("crmTasks").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect(),
      ctx.db.query("users").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect(),
    ]);

    const fallbackAssignee =
      users.find((u) => u.active && u.role === "admin")?._id ??
      users.find((u) => u.active)?._id;
    const openLead = new Set<string>();
    const openDeal = new Set<string>();
    const openQuote = new Set<string>();
    const automationKeys = new Set<string>();
    for (const task of tasks) {
      if (task.status === "open") {
        if (task.leadId) openLead.add(task.leadId as string);
        if (task.dealId) openDeal.add(task.dealId as string);
        if (task.quotationId) openQuote.add(task.quotationId as string);
      }
      if (task.automationKey) automationKeys.add(task.automationKey);
    }

    let leadTasks = 0;
    let dealTasks = 0;
    let quoteTasks = 0;
    let notifications = 0;

    async function addTask(input: {
      key: string;
      title: string;
      description: string;
      dueAt: number;
      priority: "low" | "normal" | "high" | "urgent";
      assigneeId?: any;
      leadId?: any;
      dealId?: any;
      quotationId?: any;
      companyId?: any;
      contactId?: any;
      link?: string;
    }) {
      if (automationKeys.has(input.key)) return false;
      const assigneeId = input.assigneeId ?? fallbackAssignee;
      const createdBy = input.assigneeId ?? fallbackAssignee;
      if (!assigneeId || !createdBy) return false;
      await ctx.db.insert("crmTasks", {
        orgId: args.orgId,
        title: input.title.slice(0, 200),
        description: input.description.slice(0, 1000),
        dueAt: input.dueAt,
        status: "open",
        priority: input.priority,
        assigneeId,
        companyId: input.companyId,
        contactId: input.contactId,
        leadId: input.leadId,
        dealId: input.dealId,
        quotationId: input.quotationId,
        automationKey: input.key,
        createdBy,
        createdAt: now,
        updatedAt: now,
      });
      automationKeys.add(input.key);
      try {
        await pushNotification(ctx, args.orgId as unknown as string, {
          userId: assigneeId as string,
          type: "crm",
          title: input.title,
          body: input.description,
          link: input.link,
        });
        notifications += 1;
      } catch {
        /* the task is more important than the notification */
      }
      return true;
    }

    const leadName = (l: (typeof leads)[number]) =>
      l.companyName ?? l.contactName ?? l.email ?? "Lead";
    const slaMs = slaHours * 3_600_000;
    const staleLeadMs = staleLeadDays * DAY;

    for (const lead of leads) {
      if (lead.status === "converted" || lead.status === "disqualified") continue;
      if (openLead.has(lead._id as string)) continue;
      if (lead.status === "new" && now - lead.createdAt >= slaMs) {
        if (
          await addTask({
            key: `lead-sla:${lead._id}`,
            title: `First contact needed: ${leadName(lead)}`,
            description: `This lead has been waiting for first contact beyond the ${slaHours}h SLA.`,
            dueAt: now,
            priority: "urgent",
            assigneeId: lead.ownerId ?? lead.createdBy,
            leadId: lead._id,
            link: "/crm/leads",
          })
        ) {
          leadTasks += 1;
        }
        continue;
      }
      if (now - lead.updatedAt >= staleLeadMs) {
        if (
          await addTask({
            key: `lead-stale:${lead._id}:${weekKey(now)}`,
            title: `Follow up with ${leadName(lead)}`,
            description: `This ${lead.status} lead has had no update for ${staleLeadDays}+ days.`,
            dueAt: now + DAY,
            priority: lead.status === "qualified" ? "high" : "normal",
            assigneeId: lead.ownerId ?? lead.createdBy,
            leadId: lead._id,
            link: "/crm/leads",
          })
        ) {
          leadTasks += 1;
        }
      }
    }

    const staleDealMs = staleDealDays * DAY;
    for (const deal of deals) {
      if (deal.status !== "open" || openDeal.has(deal._id as string)) continue;
      if (now - deal.updatedAt < staleDealMs) continue;
      if (
        await addTask({
          key: `deal-stale:${deal._id}:${weekKey(now)}`,
          title: `Follow up on deal: ${deal.title}`,
          description: `This deal has had no update for ${staleDealDays}+ days. Value: ${deal.value.toLocaleString()} ${deal.currency}.`,
          dueAt: now + DAY,
          priority: deal.value >= 100_000 ? "high" : "normal",
          assigneeId: deal.ownerId ?? deal.createdBy,
          dealId: deal._id,
          companyId: deal.companyId,
          contactId: deal.contactId,
          link: "/crm/deals",
        })
      ) {
        dealTasks += 1;
      }
    }

    const quoteWindow = quoteFollowUpDays * DAY;
    for (const quote of quotes) {
      if (quote.status !== "sent" || openQuote.has(quote._id as string)) continue;
      const validUntil = quote.validUntil
        ? Date.parse(`${quote.validUntil}T23:59:59Z`)
        : quote.sentAt
        ? quote.sentAt + quoteWindow
        : null;
      if (!validUntil || now < validUntil - quoteWindow) continue;

      let assigneeId = quote.createdBy;
      let companyId = quote.companyId;
      let contactId = quote.contactId;
      let dealId = quote.dealId;
      if (quote.dealId) {
        const deal = deals.find((d) => d._id === quote.dealId);
        if (deal) {
          assigneeId = deal.ownerId ?? assigneeId;
          companyId = companyId ?? deal.companyId;
          contactId = contactId ?? deal.contactId;
          dealId = deal._id;
        }
      }
      const expired = now > validUntil;
      if (
        await addTask({
          key: `quote-followup:${quote._id}:${weekKey(now)}`,
          title: `Follow up on quote ${quote.number}`,
          description: expired
            ? `This quote expired on ${quote.validUntil ?? "its validity date"} and has not been accepted.`
            : `This quote is nearing its validity date${quote.validUntil ? ` (${quote.validUntil})` : ""}.`,
          dueAt: now + DAY,
          priority: expired ? "high" : "normal",
          assigneeId,
          dealId,
          quotationId: quote._id,
          companyId,
          contactId,
          link: `/crm/quotations/${quote._id}`,
        })
      ) {
        quoteTasks += 1;
      }
    }

    return {
      leads: leadTasks,
      deals: dealTasks,
      quotes: quoteTasks,
      notifications,
    };
  },
});
