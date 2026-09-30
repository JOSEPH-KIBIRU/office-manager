import { NextResponse } from "next/server";
import { checkSubscriptions } from "@/convex/subscriptions";

export async function GET(request: Request) {
  try {
    const result = await checkSubscriptions();

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Subscription check cron error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to check subscriptions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}