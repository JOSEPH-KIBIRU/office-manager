/**
 * Single source of truth for the FAQ.
 *
 * The visible FAQ section and the FAQPage JSON-LD both render from this list so
 * the answers a visitor reads always match the answers submitted to search
 * engines. Google penalises FAQ schema whose content is missing from the page.
 */
export type FaqItem = {
  q: string;
  a: string;
};

export const FAQS: FaqItem[] = [
  {
    q: "Does Office Manager handle Kenyan statutory payroll deductions?",
    a: "Yes. Office Manager computes PAYE, NSSF, SHIF, Affordable Housing Levy and optional HELB deductions in line with current KRA rules, and generates digital payslips.",
  },
  {
    q: "Can employees apply for leave through the system?",
    a: "Yes. Employees apply for annual, sick, bereavement, maternity and other leave in seconds. Managers approve or reject with one tap, balances update automatically, and everyone is notified by SMS and email.",
  },
  {
    q: "Does Office Manager track employee attendance and working hours?",
    a: "Yes. There is a one-tap time clock for clock-in and clock-out, with configurable working days, work start and end times, and a grace period. Late arrivals beyond the grace period are flagged automatically, and each employee gets a monthly attendance summary.",
  },
  {
    q: "Does Office Manager handle leave carry-over and paying out unused leave?",
    a: "Yes. You set an annual entitlement and a carry-over cap. Unused days up to the cap roll into the new year, and any balance above the cap can optionally be encashed. At year end the encashable days are calculated per employee, then added to payroll as a leave-days payout you can prefill in one click.",
  },
  {
    q: "Can Office Manager file invoices to KRA eTIMS?",
    a: "Yes. Office Manager integrates with the Kenya Revenue Authority's electronic Tax Invoice Management System (eTIMS). You submit an invoice from the invoice screen and Office Manager stores the returned control number and prints the official eTIMS verification QR code on the invoice. A submission failure never blocks invoicing, so you can retry safely.",
  },
  {
    q: "Does Office Manager manage documents and track expiry dates?",
    a: "Yes. Contracts, national IDs, work permits, medical cards and certificates are stored against each employee, and the system alerts you automatically before a document expires so you can renew it on time.",
  },
  {
    q: "Can Office Manager track company assets and who has them?",
    a: "Yes. The asset register records laptops, phones, vehicles and other equipment with purchase value and serial numbers. Items can be checked out to a staff member and returned, leaving a full custody trail, plus movement reports for audits.",
  },
  {
    q: "Does Office Manager have a visitor management system?",
    a: "Yes. The digital visitor book records each visitor's name, phone number, host, purpose of visit and vehicle registration, with check-in and sign-out times, notifications to the host, and footfall reports.",
  },
  {
    q: "Does Office Manager automate onboarding and offboarding?",
    a: "Yes. Onboarding and offboarding checklists are created automatically when an employee account is created or deactivated, covering items such as ID and bank details, contract signing, asset handover and exit clearance.",
  },
  {
    q: "Does Office Manager include accounting and task tracking?",
    a: "Yes. The accounting module gives you a full ledger with trial balance, profit & loss and balance sheet, plus bank and M-Pesa reconciliation and VAT returns. Tasks let managers assign work to a staff member, who reports progress with photos, and managers can acknowledge or reopen the task.",
  },
  {
    q: "Does Office Manager support multi-company offices?",
    a: "Yes. Each organization gets its own fully private workspace, so staff, requests and records stay completely isolated between companies.",
  },
  {
    q: "Does Office Manager notify employees and customers automatically?",
    a: "Yes. Office Manager sends SMS and email notifications automatically for leave requests and decisions, payroll, invoices, overdue payment reminders, document expiry warnings, visitor sign-in, and task assignments.",
  },
  {
    q: "How are approvals and audit trails handled?",
    a: "When an employee submits a request, the relevant manager and admin are notified instantly. Approvals and rejections are recorded with a full audit trail and the employee is informed by SMS and email.",
  },
  {
    q: "How is company and employee data protected?",
    a: "Accounts can be protected with two-factor authentication using a 6-digit authenticator app code plus single-use recovery codes. Each company workspace is fully isolated from every other, access is restricted by role, and the KRA PIN is only ever printed on internal documents, never on customer invoices.",
  },
  {
    q: "Is Office Manager suitable for SMEs in Kenya?",
    a: "Absolutely. It is built for small and medium businesses across Kenya - combining payroll, petty cash, car logs, meetings and invoicing in one affordable platform.",
  },
];
