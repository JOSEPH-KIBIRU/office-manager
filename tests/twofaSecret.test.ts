import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { decryptTotpSecret, encryptTotpSecret } from "@/lib/twofaSecret";

const SECRET = "JBSWY3DPEHPK3PXP";
const originalKey = process.env.TOKEN_ENCRYPTION_KEY;

beforeAll(() => {
  // 32-byte base64 key
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
  else process.env.TOKEN_ENCRYPTION_KEY = originalKey;
});

describe("2FA secret storage", () => {
  it("encrypts and decrypts a TOTP secret", () => {
    const stored = encryptTotpSecret(SECRET);
    expect(stored).not.toBe(SECRET);
    expect(decryptTotpSecret(stored)).toBe(SECRET);
  });

  it("still reads legacy plaintext secrets", () => {
    expect(decryptTotpSecret(SECRET)).toBe(SECRET);
  });

  it("fails closed when no encryption key is configured, but still reads legacy plaintext", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => encryptTotpSecret(SECRET)).toThrow(/TOKEN_ENCRYPTION_KEY/);
    expect(decryptTotpSecret(SECRET)).toBe(SECRET);
  });
});
