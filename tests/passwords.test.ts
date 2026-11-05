import { describe, expect, it } from "vitest";
import { generateTempPassword, generateResetCode } from "@/lib/passwords";
import { passwordProblem } from "@/lib/passwordPolicy";

describe("temporary passwords", () => {
  it("are 12 chars with letters and digits, and unique", () => {
    const pw = generateTempPassword();
    expect(pw).toHaveLength(12);
    expect(/[A-Za-z]/.test(pw)).toBe(true);
    expect(/\d/.test(pw)).toBe(true);
    expect(passwordProblem(pw)).toBeNull();

    const many = new Set(Array.from({ length: 25 }, () => generateTempPassword()));
    expect(many.size).toBe(25);
  });
});

describe("password reset codes", () => {
  it("are six digits from a cryptographically secure generator", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateResetCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe("password policy", () => {
  it("requires at least 12 characters", () => {
    expect(passwordProblem("Short1pass")).toMatch(/12/);
    expect(passwordProblem("ValidPass123")).toBeNull();
  });

  it("requires both letters and numbers", () => {
    expect(passwordProblem("onlyletterslong")).toMatch(/letters and numbers/);
    expect(passwordProblem("123456789012")).toMatch(/letters and numbers/);
  });
});
