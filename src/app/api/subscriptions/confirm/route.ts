import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/convex/_generated/dataModel";
import { convertTrialToActive } from "@/convex/subscriptions";

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

    // Optional: check that the session user is admin of this org
    // const userOrg = await db.query("users").filter("orgId", "=", session.orgId).collect();
    // if (!userOrg.some(u => u.role === "admin")) {
    //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // }

    const result = await convertTrialToActive({ orgId });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Confirm payment error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to confirm payment" },
      { status: 500 }
    );
  }
}