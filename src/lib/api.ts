import "server-only";
import { NextResponse } from "next/server";
import { HttpError } from "./auth";

export function ok(data: unknown = { ok: true }) {
  return NextResponse.json(data);
}

export function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    console.error("[api] Unexpected error:", e);
    return fail(500, e instanceof Error ? e.message : "Internal server error");
  }
}

const MAX_JSON_BODY = 1_000_000; // 1 MB

export async function readJson<T>(req: Request): Promise<T> {
  const cl = Number(req.headers.get("content-length") || 0);
  if (cl && cl > MAX_JSON_BODY) throw new HttpError(413, "Request body too large");
  let text = "";
  try {
    text = await req.text();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  if (text.length > MAX_JSON_BODY) throw new HttpError(413, "Request body too large");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

export function requireFields(body: Record<string, unknown>, fields: string[]) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || body[f] === "") {
      throw new HttpError(400, `Missing required field: ${f}`);
    }
  }
}

/** Reject strings longer than `max` characters (trims first). */
export function maxLen(value: unknown, field: string, max: number) {
  if (typeof value !== "string" || value.length > max) {
    throw new HttpError(400, `${field} must be ${max} characters or fewer`);
  }
}

/** Validate a money value is a finite number within [min, max]. */
export function amountInRange(value: unknown, field: string, min = 0, max = 100_000_000) {
  const n = Number(value);
  if (!isFinite(n) || n < min || n > max) {
    throw new HttpError(400, `${field} must be between ${min} and ${max.toLocaleString()}`);
  }
  return n;
}

/** Validate a YYYY-MM-DD date string is well-formed. */
export function validDate(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${field} must be a valid date`);
  }
  return value;
}
