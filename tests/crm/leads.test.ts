import { describe, it, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import { makeTestBackend } from "../helpers/convex";

process.env.CONVEX_SERVER_SECRET = "test-secret";
const SECRET = "test-secret";

type Backend = ReturnType<typeof makeTestBackend>;

async function setup() {
  const t = makeTestBackend();
  const now = Date.now();
  const orgId = await t.run((ctx) =>
    ctx.db.insert("organizations", { name: "Org", slug: "org", active: true, createdAt: now })
  );
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      orgId,
      name: "Admin",
      email: "admin@org.test",
      passwordHash: "x",
      role: "admin",
      leaveBalance: 21,
      mustChangePassword: false,
      active: true,
      createdAt: now,
    })
  );
  return { t, orgId, userId };
}

describe("CRM lead conversion", () => {
  it("converts a lead into a company, contact and open deal", async () => {
    const { t, orgId, userId } = await setup();
    const pipelineId = await t.mutation(api.crmPipelines.createPipeline, {
      secret: SECRET,
      orgId,
      actorId: userId,
      name: "Sales",
    });
    await t.mutation(api.crmPipelines.createStage, {
      secret: SECRET,
      orgId,
      actorId: userId,
      pipelineId,
      name: "New",
      probability: 10,
    });

    const leadId = await t.mutation(api.crmLeads.createLead, {
      secret: SECRET,
      orgId,
      actorId: userId,
      companyName: "Acme Ltd",
      contactName: "Jane Doe",
      email: "jane@acme.test",
      value: 5000,
    });

    const res = await t.mutation(api.crmLeads.convertLead, {
      secret: SECRET,
      orgId,
      actorId: userId,
      id: leadId,
    });
    expect(res.dealId).toBeTruthy();
    expect(res.companyId).toBeTruthy();
    expect(res.contactId).toBeTruthy();

    const lead = await t.query(api.crmLeads.getLead, { secret: SECRET, orgId, id: leadId });
    expect(lead?.status).toBe("converted");

    const deals = await t.query(api.crmDeals.listDeals, { secret: SECRET, orgId, pipelineId });
    expect(deals).toHaveLength(1);
    expect(deals[0].companyId).toBe(res.companyId);
    expect(deals[0].status).toBe("open");
  });

  it("refuses to convert the same lead twice", async () => {
    const { t, orgId, userId } = await setup();
    const pipelineId = await t.mutation(api.crmPipelines.createPipeline, {
      secret: SECRET, orgId, actorId: userId, name: "Sales",
    });
    await t.mutation(api.crmPipelines.createStage, {
      secret: SECRET, orgId, actorId: userId, pipelineId, name: "New",
    });
    const leadId = await t.mutation(api.crmLeads.createLead, {
      secret: SECRET, orgId, actorId: userId, companyName: "Acme",
    });
    await t.mutation(api.crmLeads.convertLead, { secret: SECRET, orgId, actorId: userId, id: leadId });
    await expect(
      t.mutation(api.crmLeads.convertLead, { secret: SECRET, orgId, actorId: userId, id: leadId })
    ).rejects.toThrow(/already been converted/i);
  });

  it("requires a pipeline before converting", async () => {
    const { t, orgId, userId } = await setup();
    const leadId = await t.mutation(api.crmLeads.createLead, {
      secret: SECRET, orgId, actorId: userId, companyName: "Acme",
    });
    await expect(
      t.mutation(api.crmLeads.convertLead, { secret: SECRET, orgId, actorId: userId, id: leadId })
    ).rejects.toThrow(/pipeline/i);
  });
});
