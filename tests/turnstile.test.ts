import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "@/lib/turnstile";

const original = process.env.TURNSTILE_SECRET_KEY;
afterEach(() => {
  if (original === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = original;
  vi.unstubAllGlobals();
});

describe("Turnstile verification", () => {
  it("skips the check when no secret is configured", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    expect(await verifyTurnstile(undefined)).toEqual({ ok: true });
  });

  it("rejects a missing token once the secret is configured", async () => {
    process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";
    const result = await verifyTurnstile("");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/complete the verification/i);
  });

  it("accepts a token when Cloudflare confirms it", async () => {
    process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await verifyTurnstile("valid-token", "203.0.113.10")).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toContain("challenges.cloudflare.com");
    expect(String(call[1].body)).toContain("remoteip=203.0.113.10");
  });

  it("rejects a token Cloudflare does not accept", async () => {
    process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ success: false }) }))
    );
    expect((await verifyTurnstile("bad-token")).ok).toBe(false);
  });

  it("fails closed when Cloudflare is unreachable", async () => {
    process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      })
    );
    expect((await verifyTurnstile("token")).ok).toBe(false);
  });
});
