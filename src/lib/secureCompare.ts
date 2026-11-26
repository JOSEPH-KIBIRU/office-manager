import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison for shared secrets. Both values are hashed
 * first so differing lengths do not leak through timing.
 */
export function secureCompare(a: unknown, b: unknown): boolean {
  const left = typeof a === "string" ? a : "";
  const right = typeof b === "string" ? b : "";
  if (!left || !right) return false;
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}
