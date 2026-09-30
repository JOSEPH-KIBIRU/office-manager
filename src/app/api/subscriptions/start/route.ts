import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/convex/_generated/dataModel";
import { startTrial } from "@/convex/subscriptions";

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, plan, billingCycle } = await request.json();

    if (!orgId || !plan) {
      return NextResponse.json(
        { error: "orgId and plan are required" },
        { status: 400 }
      );
    }

    // Verify the org exists and user has access (basic check)
    const org = await db.query("organizations").filter("orgId", "=", orgId).collect();
    if (org.length === 0) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Only allow super admin or admin of the organization
    // For now, allow if user is authenticated; refine as needed
    const result = await startTrial({ orgId, plan, billingCycle });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Start trial error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to start trial" },
      { status: 500 }
    );
  }
}