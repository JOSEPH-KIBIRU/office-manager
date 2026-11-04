import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { makeTestBackend } from "./helpers/convex";

process.env.CONVEX_SERVER_SECRET = "test-secret";
const SECRET = "test-secret";

type Backend = ReturnType<typeof makeTestBackend>;

async function setup(plan?: "starter" | "professional" | "enterprise") {
  const t = makeTestBackend();
  const now = Date.now();
  const orgId = await t.run((ctx) =>
    ctx.db.insert("organizations", { name: "Org", slug: "org", active: true, createdAt: now })
  );
  if (plan) {
    await t.run((ctx) =>
      ctx.db.insert("subscriptions", {
        orgId,
        plan,
        billingCycle: "monthly",
        status: "trial",
        cancelAtPeriodEnd: false,
        userCount: 0,
        startedAt: now,
      })
    );
  }
  const addUser = (n: number) =>
    t.run((ctx) =>
      ctx.db.insert("users", {
        orgId,
        name: `User ${n}`,
        email: `user${n}@org.test`,
        passwordHash: "x",
        role: "employee",
        leaveBalance: 21,
        mustChangePassword: false,
        active: true,
        createdAt: now,
      })
    );
  return { t, orgId, addUser };
}

async function createUser(t: Backend, orgId: any, n: number) {
  return t.mutation(api.users.createUser, {
    secret: SECRET,
    orgId,
    name: `New ${n}`,
    email: `new${n}@org.test`,
    role: "employee",
    passwordHash: "x",
  });
}

describe("plan user limits", () => {
  it("blocks a starter (trial) company at 10 users", async () => {
    const { t, orgId, addUser } = await setup("starter");
    for (let i = 1; i <= 10; i++) await addUser(i);
    await expect(createUser(t, orgId, 99)).rejects.toThrow(/allows up to 10 users/i);
  });

  it("allows a starter company below the limit", async () => {
    const { t, orgId, addUser } = await setup("starter");
    for (let i = 1; i <= 9; i++) await addUser(i);
    const id = await createUser(t, orgId, 99);
    expect(id).toBeTruthy();
  });

  it("allows a professional company beyond 10 (up to 20)", async () => {
    const { t, orgId, addUser } = await setup("professional");
    for (let i = 1; i <= 10; i++) await addUser(i);
    const id = await createUser(t, orgId, 99);
    expect(id).toBeTruthy();
  });

  it("leaves companies with no subscription grandfathered", async () => {
    const { t, orgId, addUser } = await setup();
    for (let i = 1; i <= 12; i++) await addUser(i);
    const id = await createUser(t, orgId, 99);
    expect(id).toBeTruthy();
  });

  it("does not limit enterprise", async () => {
    const { t, orgId, addUser } = await setup("enterprise");
    for (let i = 1; i <= 30; i++) await addUser(i);
    const id = await createUser(t, orgId, 99);
    expect(id).toBeTruthy();
  });
});
