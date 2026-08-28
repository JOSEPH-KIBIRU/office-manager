export interface Errors {
  [field: string]: string | undefined;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^\+?[0-9\s-]{9,15}$/;

/** Runs a ruleset against form values; returns map of field -> error message. */
export function validate(
  values: Record<string, unknown>,
  rules: Record<string, Array<(v: unknown, all: Record<string, unknown>) => string | null>>
): Errors {
  const errors: Errors = {};
  for (const [field, checks] of Object.entries(rules)) {
    for (const check of checks) {
      const msg = check(values[field], values);
      if (msg) {
        errors[field] = msg;
        break;
      }
    }
  }
  return errors;
}

// ---- reusable rule factories -------------------------------------------

export function required(label: string) {
  return (v: unknown): string | null => {
    if (typeof v === "string" ? v.trim() === "" : v === undefined || v === null || v === "") {
      return `${label} is required`;
    }
    return null;
  };
}

export function email(label = "Email") {
  return (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    if (!s) return null; // empty handled by `required`
    return EMAIL_RE.test(s) ? null : `${label} is not a valid address`;
  };
}

export function phone(label = "Phone number", optional = true) {
  return (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    if (!s) return optional ? null : `${label} is required`;
    return PHONE_RE.test(s)
      ? null
      : `${label} must be 9–15 digits, optionally starting with +`;
  };
}

export function minLen(n: number, label: string) {
  return (v: unknown): string | null => {
    const s = String(v ?? "");
    if (!s) return null;
    return s.length >= n ? null : `${label} must be at least ${n} characters`;
  };
}

export function minNum(min: number, label: string) {
  return (v: unknown): string | null => {
    if (v === "" || v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= min ? null : `${label} must be at least ${min}`;
  };
}

export function dateOrder(startField: string, endField: string, endLabel: string, startLabel: string) {
  return (_v: unknown, all: Record<string, unknown>): string | null => {
    const s = String(all[startField] ?? "");
    const e = String(all[endField] ?? "");
    if (!s || !e) return null;
    return e >= s ? null : `${endLabel} cannot be before ${startLabel}`;
  };
}

export function pastOrToday(label: string) {
  return (v: unknown): string | null => {
    const s = String(v ?? "");
    if (!s) return null;
    const today = new Date().toISOString().slice(0, 10);
    return s <= today ? null : `${label} cannot be in the future`;
  };
}

export function notInPast(label: string) {
  return (v: unknown): string | null => {
    const s = String(v ?? "");
    if (!s) return null;
    const today = new Date().toISOString().slice(0, 10);
    return s >= today ? null : `${label} cannot be in the past`;
  };
}
