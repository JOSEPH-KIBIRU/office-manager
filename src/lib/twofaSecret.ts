import "server-only";
import { decryptToken, encryptToken } from "@/lib/email/crypto";

/**
 * Encrypt TOTP secrets at rest. Fails closed: if the encryption key is not
 * configured we refuse to store the secret rather than silently writing it in
 * plaintext. Legacy plaintext values are still readable (see decrypt).
 */
export function encryptTotpSecret(plain: string): string {
  return encryptToken(plain);
}

/**
 * Decrypt a stored TOTP secret. Values written before encryption was
 * introduced are plaintext: if decryption fails we return the value as-is.
 */
export function decryptTotpSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    return decryptToken(stored);
  } catch {
    return stored;
  }
}
