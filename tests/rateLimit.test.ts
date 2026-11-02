import { describe, it, expect } from "vitest";
import { rateLimit, rateLimitKey } from "@/lib/rateLimit";

describe("rate-limit identity", () => {
  it("keys authenticated requests by organisation + user, never by IP", () => {
    expect(rateLimitKey({ id: "u1", orgId: "o1" }, "1.2.3.4")).toBe("org:o1:user:u1");
    expect(rateLimitKey({ id: "u2", orgId: "o1" }, "1.2.3.4")).toBe("org:o1:user:u2");
  });

  it("handles a missing org", () => {
    expect(rateLimitKey({ id: "u1" }, "1.2.3.4")).toBe("org:none:user:u1");
  });

  it("falls back to IP only when unauthenticated", () => {
    expect(rateLimitKey(null, "1.2.3.4")).toBe("ip:1.2.3.4");
    expect(rateLimitKey(undefined, "9.9.9.9")).toBe("ip:9.9.9.9");
  });
});

describe("fixed-window limiter", () => {
  it("allows up to the limit then blocks", () => {
    const key = `test:limit:${Date.now()}:${Math.random()}`;
    expect(rateLimit({ key, limit: 2, windowMs: 60_000 })).toBe(true);
    expect(rateLimit({ key, limit: 2, windowMs: 60_000 })).toBe(true);
    expect(rateLimit({ key, limit: 2, windowMs: 60_000 })).toBe(false);
  });

  it("keeps colleagues sharing an IP independent", () => {
    const ip = "10.0.0.1";
    const k1 = rateLimitKey({ id: "u1", orgId: "o1" }, ip);
    const k2 = rateLimitKey({ id: "u2", orgId: "o1" }, ip);
    expect(k1).not.toBe(k2);

    expect(rateLimit({ key: k1, limit: 1, windowMs: 60_000 })).toBe(true);
    expect(rateLimit({ key: k1, limit: 1, windowMs: 60_000 })).toBe(false);
    // The second user on the same IP is unaffected.
    expect(rateLimit({ key: k2, limit: 1, windowMs: 60_000 })).toBe(true);
  });
});
