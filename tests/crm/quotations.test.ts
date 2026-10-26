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

const ITEM = { description: "Widget", qty: 2, unitPrice: 100, taxRate: 16 };

describe("CRM quotations", () => {
  it("computes totals and numbers quotations", async () => {
    const { t, orgId, userId } = await setup();
    const res = await t.mutation(api.crmQuotations.createQuotation, {
      secret: SECRET,
      orgId,
      actorId: userId,
      issueDate: "2026-01-01",
      items: [ITEM, { description: "Fee", qty: 1, unitPrice: 50, taxRate: 0 }],
    });
    expect(res.number).toBe("QUO-0001");

    const q = await t.query(api.crmQuotations.getQuotation, { secret: SECRET, orgId, id: res.id });
    expect(q?.subtotal).toBe(250);
    expect(q?.taxTotal).toBe(32);
    expect(q?.total).toBe(282);
    expect(q?.items).toHaveLength(2);
  });

  it("rejects an empty quotation and a direct 'converted' status", async () => {
    const { t, orgId, userId } = await setup();
    await expect(
      t.mutation(api.crmQuotations.createQuotation, {
        secret: SECRET,
        orgId,
        actorId: userId,
        issueDate: "2026-01-01",
        items: [],
      })
    ).rejects.toThrow(/at least one/i);

    const res = await t.mutation(api.crmQuotations.createQuotation, {
      secret: SECRET,
      orgId,
      actorId: userId,
      issueDate: "2026-01-01",
      items: [ITEM],
    });
    await expect(
      t.mutation(api.crmQuotations.setQuotationStatus, {
        secret: SECRET,
        orgId,
        actorId: userId,
        id: res.id,
        status: "converted",
      })
    ).rejects.toThrow(/convert action/i);
  });

  it("marks a quotation converted with its invoice and is idempotent", async () => {
    const { t, orgId, userId } = await setup();
    const q = await t.mutation(api.crmQuotations.createQuotation, {
      secret: SECRET,
      orgId,
      actorId: userId,
      issueDate: "2026-01-01",
      items: [ITEM],
    });
    const contactId = await t.mutation(api.invoicing.createContact, {
      secret: SECRET,
      orgId,
      type: "customer",
      name: "Customer Ltd",
    });
    const invoiceId = await t.mutation(api.invoicing.createInvoice, {
      secret: SECRET,
      orgId,
      contactId,
      issueDate: "2026-01-02",
      dueDate: "2026-02-01",
      lineItems: [ITEM],
      createdBy: userId,
    });

    const first = await t.mutation(api.crmQuotations.markConverted, {
      secret: SECRET,
      orgId,
      actorId: userId,
      id: q.id,
      invoiceId,
    });
    expect(first.already).toBe(false);

    const second = await t.mutation(api.crmQuotations.markConverted, {
      secret: SECRET,
      orgId,
      actorId: userId,
      id: q.id,
      invoiceId,
    });
    expect(second.already).toBe(true);

    const after = await t.query(api.crmQuotations.getQuotation, { secret: SECRET, orgId, id: q.id });
    expect(after?.status).toBe("converted");
    expect(after?.invoiceId).toBe(invoiceId);
  });
});
