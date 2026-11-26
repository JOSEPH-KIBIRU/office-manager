import { describe, expect, it } from "vitest";
import { secureCompare } from "@/lib/secureCompare";

describe("secureCompare", () => {
  it("accepts identical secrets", () => {
    expect(secureCompare("correct-horse", "correct-horse")).toBe(true);
  });

  it("rejects different secrets, prefixes and empty values", () => {
    expect(secureCompare("correct-horse", "correct-horse-battery")).toBe(false);
    expect(secureCompare("correct", "correct-horse")).toBe(false);
    expect(secureCompare("", "")).toBe(false);
    expect(secureCompare(undefined, "secret")).toBe(false);
  });
});
