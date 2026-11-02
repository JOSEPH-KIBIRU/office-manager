import crypto from "node:crypto";

/**
 * Cryptographically secure temporary password. 12 chars, guaranteed to contain
 * letters and digits, excluding ambiguous characters (0/O, 1/l/I).
 */
export function generateTempPassword(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = letters + digits;
  const pick = (set: string) => set[crypto.randomInt(set.length)];

  const chars = [pick(letters), pick(letters), pick(digits), pick(digits)];
  while (chars.length < 12) chars.push(pick(all));

  // Shuffle so the guaranteed characters are not always in the same position.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
