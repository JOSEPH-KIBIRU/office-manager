import { describe, it, expect } from "vitest";
import { api } from "../convex/_generated/api";
import { makeTestBackend } from "./helpers/convex";

process.env.CONVEX_SERVER_SECRET = "test-secret";
const SECRET = "test-secret";

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
      passwordHash: "old",
      role: "admin",
      leaveBalance: 21,
      mustChangePassword: false,
      active: true,
      createdAt: now,
    })
  );
  return { t, orgId, userId };
}

describe("session validity", () => {
  it("accepts a matching session version and rejects a stale one", async () => {
    const { t, orgId, userId } = await setup();
    const ok = await t.query(api.auth.validateSession, {
      secret: SECRET,
      id: userId,
      orgId,
      sessionVersion: 0,
    });
    expect(ok?.id).toBe(userId);

    const stale = await t.query(api.auth.validateSession, {
      secret: SECRET,
      id: userId,
      orgId,
      sessionVersion: 1,
    });
    expect(stale).toBeNull();
  });

  it("bumps the session version on password change, invalidating old sessions", async () => {
    const { t, orgId, userId } = await setup();
    const res = await t.mutation(api.users.patchUser, {
      secret: SECRET,
      orgId,
      id: userId,
      newPasswordHash: "new",
    });
    expect(res.sessionVersion).toBe(1);

    const old = await t.query(api.auth.validateSession, {
      secret: SECRET,
      id: userId,
      orgId,
      sessionVersion: 0,
    });
    expect(old).toBeNull();

    const fresh = await t.query(api.auth.validateSession, {
      secret: SECRET,
      id: userId,
      orgId,
      sessionVersion: 1,
    });
    expect(fresh?.id).toBe(userId);
  });

  it("rejects a deactivated user even with the current version", async () => {
    const { t, orgId, userId } = await setup();
    const res = await t.mutation(api.users.patchUser, {
      secret: SECRET,
      orgId,
      id: userId,
      active: false,
    });
    const user = await t.query(api.auth.validateSession, {
      secret: SECRET,
      id: userId,
      orgId,
      sessionVersion: res.sessionVersion,
    });
    expect(user).toBeNull();
  });

  it("only accepts super_admin inside the platform org", async () => {
    const { t, orgId, userId } = await setup();
    await t.run((ctx) => ctx.db.patch(userId, { role: "super_admin" }));
    const companySuper = await t.query(api.auth.validateSession, {
      secret: SECRET,
      id: userId,
      orgId,
      sessionVersion: 0,
    });
    expect(companySuper).toBeNull();

    const now = Date.now();
    const platformOrg = await t.run((ctx) =>
      ctx.db.insert("organizations", { name: "Platform", slug: "__platform", active: true, createdAt: now })
    );
    const platformUser = await t.run((ctx) =>
      ctx.db.insert("users", {
        orgId: platformOrg,
        name: "Owner",
        email: "owner@platform.test",
        passwordHash: "x",
        role: "super_admin",
        leaveBalance: 21,
        mustChangePassword: false,
        active: true,
        createdAt: now,
      })
    );
    const platformOk = await t.query(api.auth.validateSession, {
      secret: SECRET,
      id: platformUser,
      orgId: platformOrg,
      sessionVersion: 0,
    });
    expect(platformOk?.id).toBe(platformUser);
  });
});
