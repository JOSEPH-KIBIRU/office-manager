import "server-only";
import dns from "node:dns/promises";
import net from "node:net";
import { HttpError } from "./httpError";

/** True for loopback, private, link-local, CGNAT, multicast and reserved IPs. */
export function isPrivateOrReservedIp(ip: string): boolean {
  const v = ip.trim().toLowerCase();
  if (net.isIPv4(v)) {
    const parts = v.split(".").map(Number);
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0 && (parts[2] === 0 || parts[2] === 2)) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (net.isIPv6(v)) {
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fe80:")) return true; // link-local
    if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique local
    // IPv4-mapped IPv6 (::ffff:10.0.0.1)
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateOrReservedIp(mapped[1]);
    return false;
  }
  return true; // not an IP → treat as unsafe
}

/**
 * Validate an outbound URL and reject SSRF targets: only http(s), no embedded
 * credentials, and every resolved address must be public. Callers should also
 * disable redirects on the actual fetch.
 */
export async function assertSafeOutboundHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, "Invalid outbound URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new HttpError(400, "Outbound URL must use http or https");
  }
  if (url.username || url.password) {
    throw new HttpError(400, "Outbound URL must not contain credentials");
  }
  if (!url.hostname) throw new HttpError(400, "Outbound URL has no host");

  // Literal IPs: check directly. Hostnames: resolve and check every address.
  const literal = url.hostname.startsWith("[") && url.hostname.endsWith("]")
    ? url.hostname.slice(1, -1)
    : url.hostname;
  if (net.isIP(literal)) {
    if (isPrivateOrReservedIp(literal)) {
      throw new HttpError(400, "Outbound URL points to a private or reserved address");
    }
    return url;
  }

  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new HttpError(400, "Outbound host could not be resolved");
  }
  if (addresses.length === 0) throw new HttpError(400, "Outbound host could not be resolved");
  if (addresses.some((a) => isPrivateOrReservedIp(a.address))) {
    throw new HttpError(400, "Outbound URL resolves to a private or reserved address");
  }
  return url;
}
