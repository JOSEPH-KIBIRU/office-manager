import { NextRequest } from "next/server";
import { getSession, HttpError } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { sendSMS, sendEmail } from "@/lib/notify";

/**
 * Send overdue-invoice payment reminders by SMS (and email when configured).
 * Runs daily via Vercel Cron, and can also be triggered by an admin/secretary
 * ("Send reminders now"). Uses the company's own payment instructions
 * (bank / PesaLink / M-Pesa) rather than a pay link.
 */
function cronAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  // Vercel Cron requests carry this header.
  return req.headers.get("x-vercel-cron") === "1";
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const isCron = cronAuthorized(req);
    let orgId: string | undefined;

    if (!isCron) {
      const session = await getSession();
      if (!session || (session.role !== "admin" && session.role !== "secretary")) {
        throw new HttpError(401, "Not authorized");
      }
      orgId = session.orgId;
    }

    let due;
    try {
      due = await cx().query(api.reminders.dueForReminder, {
        secret: secret(),
        now: Date.now(),
        orgId: orgId as never,
      });
    } catch (e) {
      return mapConvexError(e);
    }

    let sent = 0;
    let skipped = 0;
    let marked = 0;

    for (const r of due) {
      const payLine = (r.paymentDetails || "").replace(/\s+/g, " ").trim().slice(0, 180);
      const sms =
        `${r.orgName}: Invoice ${r.number} for KES ${r.total.toLocaleString("en-KE")} was due ` +
        `${r.dueDate} (${r.daysOverdue} day(s) overdue).${payLine ? " " + payLine : ""}`;

      let didSend = false;
      if (r.contactPhone) {
        try {
          if (await sendSMS(r.contactPhone, sms)) didSend = true;
        } catch {
          /* ignore and try email */
        }
      }
      if (r.contactEmail) {
        try {
          const html =
            `<p>Dear ${r.contactName},</p>` +
            `<p>Our invoice <strong>${r.number}</strong> for <strong>KES ${r.total.toLocaleString("en-KE")}</strong> ` +
            `was due on <strong>${r.dueDate}</strong> and is now ${r.daysOverdue} day(s) overdue.</p>` +
            (r.paymentDetails ? `<p><strong>How to pay</strong><br/>${r.paymentDetails.replace(/\n/g, "<br/>")}</p>` : "") +
            `<p>Thank you,<br/>${r.orgName}</p>`;
          if (await sendEmail(r.contactEmail, `Payment reminder — invoice ${r.number}`, html)) didSend = true;
        } catch {
          /* ignore */
        }
      }

      if (didSend) {
        await cx().mutation(api.reminders.recordReminder, {
          secret: secret(),
          invoiceId: r.invoiceId as never,
          markOverdue: true,
        });
        sent += 1;
        marked += 1;
      } else {
        skipped += 1;
      }
    }

    return ok({ due: due.length, sent, skipped, marked });
  });
}
