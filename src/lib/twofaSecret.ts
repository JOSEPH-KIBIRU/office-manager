import "server-only";
import { decryptToken, encryptToken } from "@/lib/email/crypto";

/**
 * Encrypt TOTP secrets at rest. If the encryption key is not configured, we
 * store the value unchanged (legacy behaviour) rather than breaking 2FA.
 */
export function encryptTotpSecret(plain: string): string {
  try {
    return encryptToken(plain);
  } catch {
    return plain;
  }
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
