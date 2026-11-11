import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { makeTestBackend } from "./helpers/convex";

process.env.CONVEX_SERVER_SECRET = "test-secret";
const SECRET = "test-secret";
const DAY = 86_400_000;

describe("CRM follow-up automation", () => {
  it("creates SLA, stale lead, stale deal and quote follow-ups exactly once", async () => {
    const t = makeTestBackend();
    const now = Date.now();
    const date = (offsetDays: number) => new Date(now + offsetDays * DAY).toISOString().slice(0, 10);

    const orgId = await t.run((ctx) =>
      ctx.db.insert("organizations", {
        name: "Automation Test",
        slug: "automation-test",
        active: true,
        createdAt: now,
      })
    );
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        orgId,
        name: "Admin",
        email: "admin@automation.test",
        passwordHash: "x",
        role: "admin",
        leaveBalance: 21,
        mustChangePassword: false,
        active: true,
        createdAt: now,
      })
    );
    const pipelineId = await t.run((ctx) =>
      ctx.db.insert("crmPipelines", {
        orgId,
        name: "Sales",
        isDefault: true,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
    );
    const stageId = await t.run((ctx) =>
      ctx.db.insert("crmStages", {
        orgId,
        pipelineId,
        name: "New",
        order: 0,
        isWon: false,
        isLost: false,
        createdAt: now,
      })
    );

    await t.run(async (ctx) => {
      await ctx.db.insert("crmLeads", {
        orgId,
        companyName: "SLA Lead",
        status: "new",
        createdBy: userId,
        createdAt: now - 2 * DAY,
        updatedAt: now - 2 * DAY,
      });
      await ctx.db.insert("crmLeads", {
        orgId,
        companyName: "Stale Lead",
        status: "qualified",
        ownerId: userId,
        createdBy: userId,
        createdAt: now - 10 * DAY,
        updatedAt: now - 10 * DAY,
      });
      await ctx.db.insert("crmDeals", {
        orgId,
        pipelineId,
        stageId,
        title: "Stale Deal",
        value: 250000,
        currency: "KES",
        ownerId: userId,
        status: "open",
        createdBy: userId,
        createdAt: now - 20 * DAY,
        updatedAt: now - 10 * DAY,
      });
      await ctx.db.insert("crmQuotations", {
        orgId,
        number: "QUO-0001",
        status: "sent",
        issueDate: date(-5),
        validUntil: date(1),
        currency: "KES",
        subtotal: 1000,
        taxTotal: 160,
        total: 1160,
        sentAt: now - 5 * DAY,
        createdBy: userId,
        createdAt: now - 5 * DAY,
        updatedAt: now - 5 * DAY,
      });
    });

    const args = {
      secret: SECRET,
      orgId,
      now,
      staleLeadDays: 3,
      staleDealDays: 7,
      slaHours: 24,
      quoteFollowUpDays: 3,
    };

    const first = await t.mutation(api.crmAutomation.runForOrg, args);
    expect(first).toMatchObject({ leads: 2, deals: 1, quotes: 1 });

    const tasks = await t.run((ctx) =>
      ctx.db.query("crmTasks").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect()
    );
    expect(tasks).toHaveLength(4);
    expect(tasks.every((task) => Boolean(task.automationKey))).toBe(true);

    const second = await t.mutation(api.crmAutomation.runForOrg, args);
    expect(second).toMatchObject({ leads: 0, deals: 0, quotes: 0 });

    const after = await t.run((ctx) =>
      ctx.db.query("crmTasks").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect()
    );
    expect(after).toHaveLength(4);
  });
});
