import { afterEach, describe, expect, it } from "vitest";
import { cronAuthorized } from "@/lib/cronAuth";

const original = process.env.CRON_SECRET;
afterEach(() => {
  if (original === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = original;
});

function req(headers: Record<string, string>) {
  return new Request("https://example.test/api/cron/x", { headers });
}

describe("cron authorization", () => {
  it("accepts the matching bearer secret", () => {
    process.env.CRON_SECRET = "super-secret";
    expect(cronAuthorized(req({ authorization: "Bearer super-secret" }))).toBe(true);
  });

  it("rejects a wrong bearer secret", () => {
    process.env.CRON_SECRET = "super-secret";
    expect(cronAuthorized(req({ authorization: "Bearer wrong" }))).toBe(false);
  });

  it("does NOT trust the spoofable x-vercel-cron header", () => {
    process.env.CRON_SECRET = "super-secret";
    expect(cronAuthorized(req({ "x-vercel-cron": "1" }))).toBe(false);
  });

  it("fails closed when CRON_SECRET is not configured", () => {
    delete process.env.CRON_SECRET;
    expect(cronAuthorized(req({ authorization: "Bearer super-secret" }))).toBe(false);
  });

  it("does not accept the secret in the query string", () => {
    process.env.CRON_SECRET = "super-secret";
    const r = new Request("https://example.test/api/cron/x?key=super-secret");
    expect(cronAuthorized(r)).toBe(false);
  });

  it("rejects a longer token that merely contains the secret", () => {
    process.env.CRON_SECRET = "super-secret";
    expect(cronAuthorized(req({ authorization: "Bearer super-secret-extra" }))).toBe(false);
    expect(cronAuthorized(req({ authorization: "Bearer  super-secret" }))).toBe(false);
  });
});
