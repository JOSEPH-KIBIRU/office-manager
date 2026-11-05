import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { makeTestBackend } from "./helpers/convex";

process.env.CONVEX_SERVER_SECRET = "test-secret";
const SECRET = "test-secret";

async function setup() {
  const t = makeTestBackend();
  const now = Date.now();
  const platformOrg = await t.run((ctx) =>
    ctx.db.insert("organizations", { name: "Platform", slug: "__platform", active: true, createdAt: now })
  );
  const mk = (email: string, name: string, platformRole: "platform_owner" | "superadmin") =>
    t.run((ctx) =>
      ctx.db.insert("users", {
        orgId: platformOrg,
        name,
        email,
        passwordHash: "x",
        role: "super_admin",
        platformRole,
        leaveBalance: 21,
        mustChangePassword: false,
        active: true,
        createdAt: now,
      })
    );
  const owner = await mk("owner@p.test", "Owner", "platform_owner");
  const delegate = await mk("delegate@p.test", "Delegate", "superadmin");
  const company = await t.run((ctx) =>
    ctx.db.insert("organizations", { name: "Acme", slug: "acme", active: true, createdAt: now })
  );
  return { t, platformOrg, owner, delegate, company };
}

describe("platform team roles", () => {
  it("lists owners and delegates; delegates cannot create superadmins", async () => {
    const { t, owner, delegate } = await setup();
    const list = await t.query(api.superadmin.listPlatformAdmins, { secret: SECRET, superAdminId: owner });
    expect(list.me.isOwner).toBe(true);
    expect(list.admins).toHaveLength(2);
    expect(list.admins[0].is_owner).toBe(true);

    await expect(
      t.mutation(api.superadmin.createPlatformAdmin, {
        secret: SECRET,
        superAdminId: delegate,
        name: "Nope",
        email: "nope@p.test",
        passwordHash: "x",
      })
    ).rejects.toThrow(/Only the platform owner/i);

    const created = await t.mutation(api.superadmin.createPlatformAdmin, {
      secret: SECRET,
      superAdminId: owner,
      name: "New Admin",
      email: "new@p.test",
      phone: "+254712345678",
      passwordHash: "x",
    });
    expect(created.email).toBe("new@p.test");
  });

  it("lets the owner delete a delegate, but protects owners and self", async () => {
    const { t, owner, delegate } = await setup();

    // A delegate cannot remove an owner.
    await expect(
      t.mutation(api.superadmin.deletePlatformAdmin, {
        secret: SECRET,
        superAdminId: delegate,
        id: owner,
      })
    ).rejects.toThrow(/Only the platform owner/i);

    // The owner can remove the delegate.
    await t.mutation(api.superadmin.deletePlatformAdmin, {
      secret: SECRET,
      superAdminId: owner,
      id: delegate,
    });

    // The owner cannot delete their own account.
    await expect(
      t.mutation(api.superadmin.deletePlatformAdmin, {
        secret: SECRET,
        superAdminId: owner,
        id: owner,
      })
    ).rejects.toThrow(/cannot delete your own|owner account/i);
  });

  it("blocks delegates from archiving/deleting companies but allows suspend", async () => {
    const { t, owner, delegate, company } = await setup();

    await expect(
      t.mutation(api.superadmin.softDeleteCompany, {
        secret: SECRET,
        superAdminId: delegate,
        orgId: company,
      })
    ).rejects.toThrow(/Only the platform owner/i);

    // Suspending/reactivating is allowed for delegates.
    await t.mutation(api.superadmin.setCompanyActive, {
      secret: SECRET,
      superAdminId: delegate,
      orgId: company,
      active: false,
    });

    // The owner can archive.
    await t.mutation(api.superadmin.softDeleteCompany, {
      secret: SECRET,
      superAdminId: owner,
      orgId: company,
    });

    // Delegates cannot permanently delete either.
    await expect(
      t.mutation(api.superadmin.purgeCompanyBatch, {
        secret: SECRET,
        superAdminId: delegate,
        orgId: company,
      })
    ).rejects.toThrow(/Only the platform owner/i);
  });
});
