import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { handle, ok, readJson, maxLen } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { notifySuperAdminOfEnquiry } from "@/lib/notify";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { allowDistributed } from "@/lib/distributedRateLimit";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const ip = clientIp(req);
    if (!rateLimit({ key: `enquiry:${ip}`, limit: 5, windowMs: 5 * 60_000 })) {
      throw new HttpError(429, "Too many messages. Please try again in a few minutes.");
    }
    const gate = await allowDistributed(`enquiry:${ip}`, 10, 5 * 60_000);
    if (!gate.allowed) {
      throw new HttpError(429, "Too many messages. Please try again in a few minutes.");
    }
    const body = await readJson<{
      name?: string;
      email?: string;
      phone?: string;
      company?: string;
      subject?: string;
      message?: string;
    }>(req);

    const phone = String(body.phone ?? "").trim().replace(/[^0-9+]/g, "");
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 9 || phoneDigits.length > 13) {
      throw new HttpError(400, "Please enter a valid phone number");
    }

    // Demo requests only need a phone number. Keep the stored enquiry useful
    // for the sales team by filling the remaining fields with clear defaults.
    // Every field is bounded so the public form cannot send huge SMS alerts or
    // store oversized records.
    const name = String(body.name ?? "").trim().replace(/[\r\n]+/g, " ") || "Website demo request";
    if (body.name && name.length < 2) throw new HttpError(400, "Please enter your full name");
    maxLen(name, "Name", 100);

    const email = String(body.email ?? "").trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, "Please enter a valid email address");
    }
    maxLen(email, "Email", 254);

    const company = String(body.company ?? "").trim().replace(/[\r\n]+/g, " ");
    maxLen(company, "Company", 120);

    const message = String(body.message ?? "").trim() || "Requested a demo callback from the website.";
    if (body.message && message.length < 5) {
      throw new HttpError(400, "Please enter a message (at least 5 characters)");
    }
    maxLen(message, "Message", 2000);

    const subject =
      String(body.subject ?? "").trim().replace(/[\r\n]+/g, " ") || "Demo request";
    maxLen(subject, "Subject", 120);

    // One phone number cannot trigger unlimited SMS alerts. This is separate
    // from the per-IP limit so rotating IPs does not bypass it.
    const phoneGate = await allowDistributed(
      `enquiry:phone:${phoneDigits}`,
      3,
      24 * 60 * 60_000
    );
    if (!phoneGate.allowed) {
      throw new HttpError(
        429,
        "We already have a recent request from this number. Please call us instead."
      );
    }

    let id: string;
    try {
      const result = await cx().mutation(api.enquiries.createEnquiry, {
        secret: secret(),
        name,
        email,
        phone,
        company: company || undefined,
        subject,
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
        company: company || null,
        subject,
        message,
      });
    } catch (e) {
      console.error("[enquiries] SMS alert failed:", e);
    }

    return ok({ id });
  });
}
