import { describe, expect, it } from "vitest";
import { PLANS } from "@/lib/plans";
import { PLAN_USER_LIMITS } from "../convex/plans";

describe("plan seat limits", () => {
  it("stays in sync between the UI plan definitions and the backend", () => {
    for (const p of PLANS) {
      expect(PLAN_USER_LIMITS[p.key]).toBe(p.maxUsers);
    }
  });
});
