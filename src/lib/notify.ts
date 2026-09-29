import "server-only";
import { Resend } from "resend";
import { cx, secret, api } from "./convex";
import { siteUrl } from "./siteUrl";

const TALKSASA_DEFAULT_BASE = "https://bulksms.talksasa.com/api/v3";

function toInternationalSMSNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) {
    digits = "254" + digits.slice(1); // Kenyan local -> international
  } else if (digits.startsWith("254") && digits.length === 12) {
    // already international
  } else if (digits.length === 9) {
    digits = "254" + digits; // e.g. "798118515" -> "254798118515"
  }
  return digits;
}

interface NotifyUser {
  id?: string | number;
  name: string;
  email: string;
  phone: string | null | undefined;
  leave_balance?: number;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[email] RESEND_API_KEY not set — skipped email "${subject}" to ${to}`);
    return false;
  }
  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Office Manager <onboarding@resend.dev>",
      to,
      subject,
      html,
    });
    if (error) {
      console.error(`[email] Failed to ${to}:`, error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] Error:", e);
    return false;
  }
}

export async function sendSMS(to: string | null | undefined, message: string): Promise<boolean> {
  const key = process.env.TALKSASA_API_KEY;
  if (!to) return false;
  if (!key) {
    console.warn(`[sms] TALKSASA_API_KEY not set — skipped SMS to ${to}`);
    return false;
  }
  try {
    const base = process.env.TALKSASA_BASE_URL || TALKSASA_DEFAULT_BASE;
    const res = await fetch(`${base.replace(/\/$/, "")}/sms/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        recipient: toInternationalSMSNumber(to),
        sender_id: process.env.TALKSASA_SENDER_ID || "OFFICE",
        type: "plain",
        message,
      }),
    });
    if (!res.ok) {
      console.error(`[sms] Failed to ${toInternationalSMSNumber(to)}: HTTP ${res.status} - ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[sms] Error:", e);
    return false;
  }
}

function emailShell(title: string, bodyHtml: string): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
    <h2 style="color:#1e3a5f;margin-top:0">${title}</h2>
    ${bodyHtml}
    <p style="color:#6b7280;font-size:12px;margin-top:32px">This is an automated message from the Office Management System.</p>
  </div>`;
}

interface AdminDoc {
  name: string;
  email: string;
  phone?: string | null;
}

async function getAdmins(orgId: string): Promise<AdminDoc[]> {
  return await cx().query(api.auth.getActiveAdmins, {
    secret: secret(),
    orgId: orgId as never,
  });
}

export async function notifyAdminsOfLeaveRequest(
  orgId: string,
  user: NotifyUser,
  days: number,
  startDate: string,
  endDate: string,
  leaveType: string = "annual"
) {
  const admins = await getAdmins(orgId);
  const typeLabel = leaveType.charAt(0).toUpperCase() + leaveType.slice(1);
  const title = "New Leave Application";
  const body = `<p><strong>${user.name}</strong> has applied for <strong>${typeLabel} leave</strong> — <strong>${days} day(s)</strong>, from <strong>${startDate}</strong> to <strong>${endDate}</strong>.</p>
  <p>Please log in to the Office Management System to approve or reject this request.</p>`;
  for (const admin of admins) {
    await sendEmail(admin.email, title, emailShell(title, body));
    await sendSMS(
      admin.phone,
      `New ${typeLabel} leave application from ${user.name}: ${days} day(s), ${startDate} to ${endDate}. Please approve on the Office Management System.`
    );
  }
}

export async function notifyLeaveDecision(
  user: NotifyUser,
  status: "approved" | "rejected",
  startDate: string,
  endDate: string,
  note?: string
) {
  const title = `Leave Application ${status === "approved" ? "Approved" : "Rejected"}`;
  const body = `<p>Your leave application for <strong>${startDate}</strong> to <strong>${endDate}</strong> has been <strong>${status.toUpperCase()}</strong>.</p>
  ${note ? `<p>Note: ${note}</p>` : ""}
  <p>Remaining leave balance: <strong>${user.leave_balance ?? ""} day(s)</strong>.</p>`;
  await sendEmail(user.email, title, emailShell(title, body));
  await sendSMS(
    user.phone,
    `Your leave ${startDate} to ${endDate} was ${status}. Remaining balance: ${user.leave_balance ?? ""} day(s).${note ? " Note: " + note : ""}`
  );
}

export async function sendNewUserCredentials(user: NotifyUser, tempPassword: string) {
  const loginUrl = `${siteUrl()}/login`;
  const title = "Your Office Account Has Been Created";
  const body = `<p>Hello <strong>${user.name}</strong>,</p>
  <p>An account has been created for you on the Office Management System.</p>
  <p><strong>Email:</strong> ${user.email}<br/><strong>Temporary password:</strong> ${tempPassword}</p>
  <p>Log in at <a href="${loginUrl}">${loginUrl}</a>. You will be required to change your password immediately after logging in.</p>`;
  await sendEmail(user.email, title, emailShell(title, body));
  await sendSMS(
    user.phone,
    `Welcome ${user.name}. Your office account was created. Login: ${user.email}, Temp password: ${tempPassword}. You must change it after first login.`
  );
}

export async function notifyAdmins(
  orgId: string,
  subjectText: string,
  messageHtml: string,
  smsMessage: string
) {
  const admins = await getAdmins(orgId);
  for (const admin of admins) {
    await sendEmail(admin.email, subjectText, emailShell(subjectText, messageHtml));
    await sendSMS(admin.phone, smsMessage);
  }
}

export async function notifyUser(
  orgId: string,
  userId: string,
  subject: string,
  messageHtml: string,
  smsMessage: string
) {
  let user;
  try {
    user = await cx().query(api.auth.getUserById, {
      secret: secret(),
      id: userId as never,
      orgId: orgId as never,
    });
  } catch {
    return;
  }
  if (!user) return;
  await sendEmail(user.email, subject, emailShell(subject, messageHtml));
  await sendSMS(user.phone, smsMessage);
}

export async function notifyMeetingScheduled(
  orgId: string,
  attendeeIds: Array<string | number>,
  title: string,
  scheduledAt: string,
  location: string | null
) {
  for (const id of attendeeIds) {
    await notifyUser(
      orgId,
      String(id),
      `Meeting Scheduled: ${title}`,
      `<p>You have been invited to a meeting.</p><p><strong>${title}</strong><br/>When: ${scheduledAt}<br/>Where: ${location || "TBD"}</p>`,
      `Meeting: ${title} on ${scheduledAt}${location ? " at " + location : ""}. Check the office system for the agenda.`
    );
  }
}

function taskLink(taskId: string): string {
  return `${siteUrl()}/tasks/${taskId}`;
}

/** SMS + email to the assignee when a task is issued. */
export async function notifyTaskAssigned(
  orgId: string,
  assigneeId: string,
  issuerName: string,
  title: string,
  taskId: string
) {
  const link = taskLink(taskId);
  await notifyUser(
    orgId,
    assigneeId,
    `New task from ${issuerName}: ${title}`,
    `<p><strong>${issuerName}</strong> has assigned you a task:</p>
     <p style="font-size:16px"><strong>${title}</strong></p>
     <p>Open the task here: <a href="${link}">${link}</a></p>`,
    `${issuerName} assigned you a task: "${title}". Open: ${link}`
  );
}

/** SMS + email to the issuer when a report is submitted. */
export async function notifyTaskReportSubmitted(
  orgId: string,
  creatorId: string,
  submitterName: string,
  title: string,
  taskId: string
) {
  const link = taskLink(taskId);
  await notifyUser(
    orgId,
    creatorId,
    `Task report from ${submitterName}: ${title}`,
    `<p><strong>${submitterName}</strong> submitted a report for the task:</p>
     <p style="font-size:16px"><strong>${title}</strong></p>
     <p>Review and acknowledge it here: <a href="${link}">${link}</a></p>`,
    `${submitterName} submitted a report for "${title}". Review: ${link}`
  );
}

/** Superadmin phone numbers that receive an SMS when a contact form is submitted. */
const SUPERADMIN_ALERT_PHONES = ["0798118515", "0708769459"];export async function notifySuperAdminOfEnquiry(enquiry: {
  name: string;
  email: string;
  phone: string;
  company?: string | null;
  subject?: string | null;
  message: string;
}) {
  const from = enquiry.company ? `${enquiry.name} (${enquiry.company})` : enquiry.name;
  const message = `New enquiry: ${from}\nEmail: ${enquiry.email}\nPhone: ${enquiry.phone}\n${
    enquiry.subject ? "Subject: " + enquiry.subject + "\n" : ""
  }Message: ${enquiry.message}`;
  for (const phone of SUPERADMIN_ALERT_PHONES) {
    await sendSMS(phone, message);
  }
}
