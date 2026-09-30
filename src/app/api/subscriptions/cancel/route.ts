import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/convex/_generated/dataModel";
import { cancelSubscription } from "@/convex/subscriptions";

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await request.json();

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    // Verify org exists
    const org = await db.query("organizations")
      .filter("orgId", "=", orgId)
      .collect();

    if (org.length === 0) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const result = await cancelSubscription({ orgId });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}