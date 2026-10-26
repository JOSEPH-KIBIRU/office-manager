import { describe, it, expect } from "vitest";
import { makeTestBackend } from "./helpers/convex";

/**
 * Smoke test that proves the convex-test harness boots against the real schema.
 * Tenant-isolation tests for CRM functions are added in T1.3.
 */
describe("convex-test harness", () => {
  it("boots with the real schema and can write/read a tenant row", async () => {
    const t = makeTestBackend();
    const id = await t.run((ctx) =>
      ctx.db.insert("organizations", {
        name: "Test Ltd",
        slug: "test-ltd",
        active: true,
        createdAt: Date.now(),
      })
    );
    const org = await t.run((ctx) => ctx.db.get(id));
    expect(org?.name).toBe("Test Ltd");
    expect(org?.slug).toBe("test-ltd");
  });
});
