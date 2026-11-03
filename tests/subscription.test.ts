import { describe, expect, it } from "vitest";
import { subscriptionBlocked, subscriptionWarning } from "@/lib/subscription";

const NOW = Date.UTC(2026, 0, 1);

describe("subscription banner", () => {
  it("is hidden for missing, active and healthy trial subscriptions", () => {
    expect(subscriptionWarning(null, NOW)).toBeNull();
    expect(subscriptionWarning(undefined, NOW)).toBeNull();
    expect(subscriptionWarning({ status: "active" }, NOW)).toBeNull();
    expect(subscriptionWarning({ status: "trial", trialEndsAt: NOW + 30 * 86_400_000 }, NOW)).toBeNull();
  });

  it("warns on past_due without blocking", () => {
    const w = subscriptionWarning({ status: "past_due", currentPeriodEnd: NOW - 86_400_000 }, NOW);
    expect(w?.tone).toBe("warning");
    expect(w?.title).toMatch(/overdue/i);
    expect(w?.message).toMatch(/access remains available/i);
  });

  it("flags a canceled subscription", () => {
    const w = subscriptionWarning({ status: "canceled" }, NOW);
    expect(w?.tone).toBe("danger");
    expect(w?.title).toMatch(/canceled/i);
  });

  it("flags an expired trial", () => {
    const w = subscriptionWarning({ status: "trial", trialEndsAt: NOW - 1 }, NOW);
    expect(w?.tone).toBe("danger");
    expect(w?.title).toMatch(/trial ended/i);
  });

  it("warns when a trial is ending within 7 days", () => {
    const w = subscriptionWarning({ status: "trial", trialEndsAt: NOW + 3 * 86_400_000 }, NOW);
    expect(w?.tone).toBe("warning");
    expect(w?.message).toMatch(/3 days/);
  });
});

describe("subscription blocking", () => {
  it("blocks past_due, canceled and expired trials", () => {
    expect(subscriptionBlocked({ status: "past_due" }, NOW)).toBe(true);
    expect(subscriptionBlocked({ status: "canceled" }, NOW)).toBe(true);
    expect(subscriptionBlocked({ status: "trial", trialEndsAt: NOW - 1 }, NOW)).toBe(true);
  });

  it("does not block active, healthy/ending trials or missing subscriptions", () => {
    expect(subscriptionBlocked({ status: "active" }, NOW)).toBe(false);
    expect(subscriptionBlocked({ status: "trial", trialEndsAt: NOW + 3 * 86_400_000 }, NOW)).toBe(false);
    expect(subscriptionBlocked(null, NOW)).toBe(false);
    expect(subscriptionBlocked(undefined, NOW)).toBe(false);
  });
});
