import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { makeTestBackend } from "./helpers/convex";

process.env.CONVEX_SERVER_SECRET = "test-secret";
const SECRET = "test-secret";

describe("superadmin company creation", () => {
  it("stores the admin phone for SMS delivery", async () => {
    const t = makeTestBackend();
    const now = Date.now();
    const platformOrg = await t.run((ctx) =>
      ctx.db.insert("organizations", { name: "Platform", slug: "__platform", active: true, createdAt: now })
    );
    const superAdminId = await t.run((ctx) =>
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

    const res = await t.mutation(api.superadmin.createCompany, {
      secret: SECRET,
      superAdminId,
      name: "Acme Ltd",
      adminName: "Jane Doe",
      adminEmail: "jane@acme.test",
      adminPhone: "+254712345678",
      adminPasswordHash: "x",
    });

    const admin = await t.query(api.auth.getUserById, {
      secret: SECRET,
      id: res.adminId,
      orgId: res.orgId,
    });
    expect(admin?.phone).toBe("+254712345678");
    expect(admin?.role).toBe("admin");
  });
});
