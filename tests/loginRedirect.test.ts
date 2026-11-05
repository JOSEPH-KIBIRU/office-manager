import { describe, expect, it } from "vitest";
import { postLoginPath } from "@/lib/postLogin";

describe("post-login redirect", () => {
  it("sends superadmins to the platform console and skips the terms gate", () => {
    expect(postLoginPath({ role: "super_admin", termsAgreedAt: false })).toBe("/admin");
  });

  it("sends company users to the dashboard when terms are accepted", () => {
    expect(postLoginPath({ role: "admin", termsAgreedAt: true })).toBe("/dashboard");
  });

  it("sends company users to accept-terms when needed", () => {
    expect(postLoginPath({ role: "employee", termsAgreedAt: false })).toBe("/accept-terms");
  });

  it("forces a password change first, for any role", () => {
    expect(
      postLoginPath({ role: "super_admin", mustChangePassword: true, termsAgreedAt: false })
    ).toBe("/change-password");
  });
});
