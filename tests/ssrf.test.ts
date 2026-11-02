import { describe, expect, it } from "vitest";
import { assertSafeOutboundHttpUrl, isPrivateOrReservedIp } from "@/lib/ssrf";

describe("SSRF address classifier", () => {
  it("flags loopback, private, link-local and reserved IPv4", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.1.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "255.255.255.255",
    ]) {
      expect(isPrivateOrReservedIp(ip)).toBe(true);
    }
  });

  it("allows public IPv4", () => {
    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
    expect(isPrivateOrReservedIp("1.1.1.1")).toBe(false);
  });

  it("flags IPv6 loopback, link-local and unique-local", () => {
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("fe80::1")).toBe(true);
    expect(isPrivateOrReservedIp("fd00::1")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff:10.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("2001:4860:4860::8888")).toBe(false);
  });
});

describe("outbound URL guard", () => {
  it("rejects non-HTTP(S) and credential-bearing URLs", async () => {
    await expect(assertSafeOutboundHttpUrl("ftp://example.com")).rejects.toThrow(/http/i);
    await expect(assertSafeOutboundHttpUrl("https://user:pass@example.com")).rejects.toThrow(/credentials/i);
  });

  it("rejects private/reserved literal IPs", async () => {
    await expect(assertSafeOutboundHttpUrl("http://169.254.169.254/latest")).rejects.toThrow(/private|reserved/i);
    await expect(assertSafeOutboundHttpUrl("http://127.0.0.1:8080/")).rejects.toThrow(/private|reserved/i);
  });

  it("accepts a public literal IP", async () => {
    const url = await assertSafeOutboundHttpUrl("https://8.8.8.8/path");
    expect(url.host).toBe("8.8.8.8");
  });
});
