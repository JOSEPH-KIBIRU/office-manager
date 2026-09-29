import { requireUser } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET() {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    let enquiries;
    try {
      enquiries = await cx().query(api.enquiries.listEnquiries, {
        secret: secret(),
        superAdminId: session.id as never,
      });
    } catch (e) {
      return mapConvexError(e);
    }
    return ok({ enquiries });
  });
}
