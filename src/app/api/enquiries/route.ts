import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { notifySuperAdminOfEnquiry } from "@/lib/notify";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  return handle(async () => {
    if (!rateLimit({ key: `enquiry:${clientIp(req)}`, limit: 5, windowMs: 5 * 60_000 })) {
      throw new HttpError(429, "Too many messages. Please try again in a few minutes.");
    }
    const body = await readJson<{
      name: string;
      email: string;
      phone: string;
      company?: string;
      subject?: string;
      message: string;
    }>(req);
    requireFields(body, ["name", "email", "phone", "message"]);

    const name = String(body.name).trim();
    const email = String(body.email).trim().toLowerCase();
    const phone = String(body.phone).trim().replace(/[^0-9+]/g, "");
    const message = String(body.message).trim();

    if (!name || name.length < 2) throw new HttpError(400, "Please enter your full name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Please enter a valid email address");
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 9 || phoneDigits.length > 13) {
      throw new HttpError(400, "Please enter a valid phone number");
    }
    if (!message || message.length < 5) throw new HttpError(400, "Please enter a message (at least 5 characters)");

    let id: string;
    try {
      const result = await cx().mutation(api.enquiries.createEnquiry, {
        secret: secret(),
        name,
        email,
        phone,
        company: body.company ? String(body.company).trim() : undefined,
        subject: body.subject ? String(body.subject).trim() : undefined,
        message,
      });
      id = result.id;
    } catch (e) {
      return mapConvexError(e);
    }

    // Alert the superadmins by SMS. Failure to send SMS must not fail the submission.
    try {
      await notifySuperAdminOfEnquiry({
        name,
        email,
        phone,
        company: body.company ? String(body.company).trim() : null,
        subject: body.subject ? String(body.subject).trim() : null,
        message,
      });
    } catch (e) {
      console.error("[enquiries] SMS alert failed:", e);
    }

    return ok({ id });
  });
}
