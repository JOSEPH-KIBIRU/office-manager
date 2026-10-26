import { describe, it, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import { makeTestBackend } from "../helpers/convex";

// Convex functions read the shared secret from the process env.
process.env.CONVEX_SERVER_SECRET = "test-secret";
const SECRET = "test-secret";

type Backend = ReturnType<typeof makeTestBackend>;

async function setup() {
  const t = makeTestBackend();
  const now = Date.now();
  const orgA = await t.run((ctx) =>
    ctx.db.insert("organizations", { name: "Org A", slug: "org-a", active: true, createdAt: now })
  );
  const orgB = await t.run((ctx) =>
    ctx.db.insert("organizations", { name: "Org B", slug: "org-b", active: true, createdAt: now })
  );
  const seedUser = (orgId: typeof orgA, name: string, email: string) =>
    t.run((ctx) =>
      ctx.db.insert("users", {
        orgId,
        name,
        email,
        passwordHash: "x",
        role: "admin",
        leaveBalance: 21,
        mustChangePassword: false,
        active: true,
        createdAt: now,
      })
    );
  const userA = await seedUser(orgA, "Alice A", "alice@a.test");
  const userB = await seedUser(orgB, "Bob B", "bob@b.test");
  return { t, orgA, orgB, userA, userB };
}

async function createCompany(t: Backend, orgId: any, actorId: any, name: string) {
  return t.mutation(api.crmCompanies.createCompany, { secret: SECRET, orgId, actorId, name });
}

describe("CRM tenant isolation", () => {
  it("rejects calls without the server secret", async () => {
    const { t, orgA, userA } = await setup();
    await expect(
      t.mutation(api.crmCompanies.createCompany, {
        secret: "wrong",
        orgId: orgA,
        actorId: userA,
        name: "Nope",
      })
    ).rejects.toThrow(/Unauthorized/);
  });

  it("rejects an actor who is not a member of the tenant", async () => {
    const { t, orgA, userB } = await setup();
    await expect(createCompany(t, orgA, userB, "Cross tenant")).rejects.toThrow(/Not authorized/);
  });

  it("lists only the caller's tenant rows", async () => {
    const { t, orgA, orgB, userA, userB } = await setup();
    await createCompany(t, orgA, userA, "Acme A");
    await createCompany(t, orgB, userB, "Acme B");

    const listA = await t.query(api.crmCompanies.listCompanies, { secret: SECRET, orgId: orgA });
    const listB = await t.query(api.crmCompanies.listCompanies, { secret: SECRET, orgId: orgB });
    expect(listA.map((c: any) => c.name)).toEqual(["Acme A"]);
    expect(listB.map((c: any) => c.name)).toEqual(["Acme B"]);
  });

  it("cannot read another tenant's company by id", async () => {
    const { t, orgA, orgB, userA, userB } = await setup();
    const companyB = await createCompany(t, orgB, userB, "Secret B");
    const got = await t.query(api.crmCompanies.getCompany, {
      secret: SECRET,
      orgId: orgA,
      id: companyB,
    });
    expect(got).toBeNull();
    expect(userA).toBeTruthy();
  });

  it("cannot update or delete another tenant's company", async () => {
    const { t, orgA, orgB, userA, userB } = await setup();
    const companyB = await createCompany(t, orgB, userB, "Secret B");
    await expect(
      t.mutation(api.crmCompanies.updateCompany, {
        secret: SECRET,
        orgId: orgA,
        actorId: userA,
        id: companyB,
        name: "Hijacked",
      })
    ).rejects.toThrow(/not found/i);
    await expect(
      t.mutation(api.crmCompanies.deleteCompany, {
        secret: SECRET,
        orgId: orgA,
        actorId: userA,
        id: companyB,
      })
    ).rejects.toThrow(/not found/i);
  });

  it("rejects linking a foreign company to a contact", async () => {
    const { t, orgA, orgB, userA, userB } = await setup();
    const companyB = await createCompany(t, orgB, userB, "Secret B");
    await expect(
      t.mutation(api.crmContacts.createContact, {
        secret: SECRET,
        orgId: orgA,
        actorId: userA,
        name: "Linked",
        companyId: companyB,
      })
    ).rejects.toThrow(/Company not found/i);
  });

  it("rejects a deal that references another tenant's pipeline", async () => {
    const { t, orgA, orgB, userA, userB } = await setup();
    const pipelineB = await t.mutation(api.crmPipelines.createPipeline, {
      secret: SECRET,
      orgId: orgB,
      actorId: userB,
      name: "Sales B",
    });
    const stageB = await t.mutation(api.crmPipelines.createStage, {
      secret: SECRET,
      orgId: orgB,
      actorId: userB,
      pipelineId: pipelineB,
      name: "New",
    });
    await expect(
      t.mutation(api.crmDeals.createDeal, {
        secret: SECRET,
        orgId: orgA,
        actorId: userA,
        pipelineId: pipelineB,
        stageId: stageB,
        title: "Cross deal",
        value: 100,
      })
    ).rejects.toThrow(/Pipeline not found/i);
  });

  it("rejects a quotation that references another tenant's deal", async () => {
    const { t, orgA, orgB, userA, userB } = await setup();
    const pipelineB = await t.mutation(api.crmPipelines.createPipeline, {
      secret: SECRET,
      orgId: orgB,
      actorId: userB,
      name: "Sales B",
    });
    const stageB = await t.mutation(api.crmPipelines.createStage, {
      secret: SECRET,
      orgId: orgB,
      actorId: userB,
      pipelineId: pipelineB,
      name: "New",
    });
    const dealB = await t.mutation(api.crmDeals.createDeal, {
      secret: SECRET,
      orgId: orgB,
      actorId: userB,
      pipelineId: pipelineB,
      stageId: stageB,
      title: "Deal B",
      value: 100,
    });
    await expect(
      t.mutation(api.crmQuotations.createQuotation, {
        secret: SECRET,
        orgId: orgA,
        actorId: userA,
        dealId: dealB,
        issueDate: "2026-01-01",
        items: [{ description: "Line", qty: 1, unitPrice: 10, taxRate: 16 }],
      })
    ).rejects.toThrow(/Deal not found/i);
  });

  it("rejects an activity attached to another tenant's record", async () => {
    const { t, orgA, orgB, userA, userB } = await setup();
    const companyB = await createCompany(t, orgB, userB, "Secret B");
    await expect(
      t.mutation(api.crmActivities.createActivity, {
        secret: SECRET,
        orgId: orgA,
        actorId: userA,
        entityType: "company",
        entityId: companyB,
        type: "note",
      })
    ).rejects.toThrow(/Related record not found/i);
  });

  it("numbers quotations independently per tenant", async () => {
    const { t, orgA, orgB, userA, userB } = await setup();
    const item = [{ description: "Line", qty: 1, unitPrice: 10, taxRate: 16 }];
    const qa = await t.mutation(api.crmQuotations.createQuotation, {
      secret: SECRET,
      orgId: orgA,
      actorId: userA,
      issueDate: "2026-01-01",
      items: item,
    });
    const qb = await t.mutation(api.crmQuotations.createQuotation, {
      secret: SECRET,
      orgId: orgB,
      actorId: userB,
      issueDate: "2026-01-01",
      items: item,
    });
    expect(qa.number).toBe("QUO-0001");
    expect(qb.number).toBe("QUO-0001");
  });
});
