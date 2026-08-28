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

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
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
