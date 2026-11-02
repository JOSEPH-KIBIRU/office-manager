/** Shared password policy for user-chosen passwords. */
export function passwordProblem(pw: string): string | null {
  if (typeof pw !== "string" || pw.length < 12) {
    return "Password must be at least 12 characters";
  }
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return "Password must include letters and numbers";
  }
  return null;
}
