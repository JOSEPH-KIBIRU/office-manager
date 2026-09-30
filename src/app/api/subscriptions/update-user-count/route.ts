import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/convex/_generated/dataModel";
import { updateUserCount } from "@/convex/subscriptions";

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, count } = await request.json();

    if (!orgId || count === undefined) {
      return NextResponse.json(
        { error: "orgId and count are required" },
        { status: 400 }
      );
    }

    // Verify org exists
    const org = await db.query("organizations")
      .filter("orgId", "=", orgId)
      .collect();

    if (org.length === 0) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const result = await updateUserCount({ orgId, count });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Update user count error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to update user count" },
      { status: 500 }
    );
  }
}