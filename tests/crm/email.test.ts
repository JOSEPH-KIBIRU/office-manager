import { describe, it, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import { makeTestBackend } from "../helpers/convex";

process.env.CONVEX_SERVER_SECRET = "test-secret";
const SECRET = "test-secret";

type Backend = ReturnType<typeof makeTestBackend>;

async function setup() {
  const t = makeTestBackend();
  const now = Date.now();
  const mkOrg = (name: string, slug: string) =>
    t.run((ctx) => ctx.db.insert("organizations", { name, slug, active: true, createdAt: now }));
  const orgA = await mkOrg("A", "a");
  const orgB = await mkOrg("B", "b");
  const mkUser = (orgId: typeof orgA, email: string) =>
    t.run((ctx) =>
      ctx.db.insert("users", {
        orgId,
        name: email,
        email,
        passwordHash: "x",
        role: "admin",
        leaveBalance: 21,
        mustChangePassword: false,
        active: true,
        createdAt: now,
      })
    );
  const userA = await mkUser(orgA, "a@test.local");
  const userB = await mkUser(orgB, "b@test.local");
  return { t, orgA, orgB, userA, userB };
}

const ONE = {
  providerMessageId: "msg-1",
  direction: "inbound" as const,
  from: "jane@acme.test",
  to: ["me@example.test"],
  subject: "Hello",
  receivedAt: Date.now(),
};

describe("CRM email connections", () => {
  it("keeps connections tenant-scoped", async () => {
    const { t, orgA, orgB, userA } = await setup();
    await t.mutation(api.crmEmail.upsertConnection, {
      secret: SECRET,
      orgId: orgA,
      userId: userA,
      provider: "gmail",
      accessTokenEnc: "enc",
      expiresAt: Date.now() + 3_600_000,
    });

    // Reading with another org id returns nothing.
    const cross = await t.query(api.crmEmail.getConnection, {
      secret: SECRET,
      orgId: orgB,
      userId: userA,
      provider: "gmail",
    });
    expect(cross).toBeNull();

    // Listing for another org returns nothing.
    const listB = await t.query(api.crmEmail.listMyConnections, {
      secret: SECRET,
      orgId: orgB,
      userId: userA,
    });
    expect(listB).toHaveLength(0);
  });

  it("rejects writing messages into another org's connection", async () => {
    const { t, orgA, orgB, userA } = await setup();
    const connId = await t.mutation(api.crmEmail.upsertConnection, {
      secret: SECRET,
      orgId: orgA,
      userId: userA,
      provider: "gmail",
      accessTokenEnc: "enc",
      expiresAt: Date.now() + 3_600_000,
    });
    await expect(
      t.mutation(api.crmEmail.upsertMessages, {
        secret: SECRET,
        orgId: orgB,
        connectionId: connId,
        provider: "gmail",
        messages: [ONE],
      })
    ).rejects.toThrow(/connection not found/i);
  });

  it("upserts messages idempotently and links the matching contact", async () => {
    const { t, orgA, userA } = await setup();
    const contactId = await t.run((ctx) =>
      ctx.db.insert("crmContacts", {
        orgId: orgA,
        name: "Jane",
        email: "jane@acme.test",
        createdBy: userA,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    );
    const connId = await t.mutation(api.crmEmail.upsertConnection, {
      secret: SECRET,
      orgId: orgA,
      userId: userA,
      provider: "gmail",
      accessTokenEnc: "enc",
      expiresAt: Date.now() + 3_600_000,
    });

    const first = await t.mutation(api.crmEmail.upsertMessages, {
      secret: SECRET,
      orgId: orgA,
      connectionId: connId,
      provider: "gmail",
      messages: [ONE],
    });
    expect(first.inserted).toBe(1);

    const second = await t.mutation(api.crmEmail.upsertMessages, {
      secret: SECRET,
      orgId: orgA,
      connectionId: connId,
      provider: "gmail",
      messages: [ONE],
    });
    expect(second.updated).toBe(1);

    const rows = await t.run((ctx) => ctx.db.query("crmEmailMessages").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].contactId).toBe(contactId);
  });
});
