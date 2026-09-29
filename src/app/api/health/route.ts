import { NextResponse } from "next/server";
import { cx, secret, api } from "@/lib/convex";

/**
 * Public health endpoint for external uptime monitors and the status page.
 * Returns 200 when the app and its Convex backend are reachable, 503 otherwise.
 */
export async function GET() {
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
