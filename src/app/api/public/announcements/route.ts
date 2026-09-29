import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET() {
  return handle(async () => {
    let announcements;
    try {
      announcements = await cx().query(api.superadmin.listActiveAnnouncements, {
        secret: secret(),
      });
    } catch (e) {
      return mapConvexError(e);
    }
    const res = NextResponse.json({ announcements });
    res.headers.set("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");
    return res;
  });
}
