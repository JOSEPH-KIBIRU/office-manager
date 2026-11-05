export interface LoginRedirectData {
  role?: string;
  mustChangePassword?: boolean;
  termsAgreedAt?: boolean;
}

/**
 * Where to send a user after a successful login. Super admins go to the
 * platform console and never hit the company Terms gate.
 */
export function postLoginPath(data: LoginRedirectData): string {
  if (data.mustChangePassword) return "/change-password";
  if (data.role === "super_admin") return "/admin";
  if (data.termsAgreedAt) return "/dashboard";
  return "/accept-terms";
}
