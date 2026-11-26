import { NextRequest, NextResponse } from "next/server";
import { cx, secret, api } from "@/lib/convex";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/**
 * Public health endpoint for external uptime monitors and the status page.
 * Returns 200 when the app and its Convex backend are reachable, 503 otherwise.
 */
export async function GET(req: NextRequest) {
  // Public endpoint: keep it from being used to hammer the database.
  if (!rateLimit({ key: `health:${clientIp(req)}`, limit: 120, windowMs: 60_000 })) {
    return NextResponse.json(
      { status: "rate_limited", time: new Date().toISOString() },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const t0 = Date.now();
  let convexUp = true;
  let error: string | null = null;
  try {
    await cx().query(api.health.ping, { secret: secret() });
  } catch (e) {
    convexUp = false;
    error = e instanceof Error ? e.message : "Convex unreachable";
  }
  const latencyMs = Date.now() - t0;
  const status = convexUp ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      time: new Date().toISOString(),
      checks: {
        app: "up",
        convex: convexUp ? "up" : "down",
        latencyMs,
      },
      ...(error ? { error } : {}),
    },
    { status: convexUp ? 200 : 503 }
  );
}
