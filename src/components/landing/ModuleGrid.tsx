/**
 * Comprehensive module list, grouped by area.
 *
 * This is deliberately a plain server component (no "use client", no animation
 * library) so the full text is present in the server-rendered HTML. Search
 * engine crawlers and AI answer engines index static markup far more reliably
 * than client-only content, so every module we ship is listed here in
 * human-readable prose.
 */

export type Module = {
  name: string;
  description: string;
};

export type ModuleGroup = {
  id: string;
  title: string;
  summary: string;
  modules: Module[];
};

export const MODULE_GROUPS: ModuleGroup[] = [
  {
    id: "people-hr",
    title: "People, HR & attendance",
    summary:
      "Everything needed to manage a Kenyan workforce — from the first day at the company to the annual leave cycle.",
    modules: [
      {
        name: "Dashboard",
        description:
          "A live overview of headcount, pending leave requests, unpaid invoices, cash on hand, tasks and today's attendance.",
      },
      {
        name: "Team & staff records",
        description:
          "Employee profiles with job title, department, employment type, KRA PIN, NSSF and SHIF numbers, bank and M-Pesa details, salary and leave balance.",
      },
      {
        name: "Departments & org chart",
        description:
          "Group staff into departments and view a visual org chart showing who reports to whom across the company.",
      },
      {
        name: "Onboarding & offboarding checklists",
        description:
          "Checklists are created automatically when an employee joins and when their account is deactivated, covering ID and bank details, contract signing, asset handover and exit clearance.",
      },
      {
        name: "Leave management",
        description:
          "Annual, sick, bereavement, maternity and unpaid leave requests with manager approval, SMS and email notifications, and working-day deduction that skips weekends and public holidays.",
      },
      {
        name: "Leave calendar",
        description:
          "A shared calendar of approved and pending leave so teams can see who is away, and optional sync to Google or Microsoft calendars.",
      },
      {
        name: "Leave carry-over & encashment",
        description:
          "Unused leave rolls into the new year up to a configurable cap, and any balance above the cap can be paid out through payroll as an end-of-year encashment.",
      },
      {
        name: "Attendance & time clock",
        description:
          "One-tap clock-in and clock-out, configurable working hours and grace period, automatic late detection, and per-employee monthly attendance summaries.",
      },
      {
        name: "Document register",
        description:
          "Store contracts, IDs, work permits and medical cards against each employee, with automatic expiry reminders before a document lapses.",
      },
    ],
  },
  {
    id: "payroll",
    title: "Payroll & payslips",
    summary:
      "Statutory-compliant Kenyan payroll with the extra inputs real workplaces need, and payslips employees can actually read.",
    modules: [
      {
        name: "KRA-compliant payroll",
        description:
          "Monthly payroll that automatically computes PAYE, NSSF, SHIF, the Affordable Housing Levy and optional HELB deductions under current KRA rules, with tiered NSSF and the SHIF minimum applied automatically.",
      },
      {
        name: "Casual & per diem payroll",
        description:
          "Pay casual workers by the day or week, with per diem allowances and an option to mark each run as statutory or non-statutory.",
      },
      {
        name: "Overtime, bonuses & allowances",
        description:
          "Capture overtime hours and rates, one-off bonuses, and allowances per employee or across the whole payroll run.",
      },
      {
        name: "Staff loans & advances",
        description:
          "Issue staff loans or salary advances, deduct repayments automatically from future payroll, and track the outstanding balance on each employee.",
      },
      {
        name: "Statutory exports",
        description:
          "Download P9, payroll register and statutory deduction schedules for your accountant or KRA filings, plus CSV exports for analysis.",
      },
      {
        name: "Employee payslips",
        description:
          "Each employee sees their own payslips online, and every payslip is branded with your company logo, details and KRA PIN for internal use.",
      },
    ],
  },
  {
    id: "money",
    title: "Money: invoicing, tax & accounting",
    summary:
      "Get paid faster and stay tax-compliant, from raising an invoice to filing it with KRA.",
    modules: [
      {
        name: "Invoicing",
        description:
          "Create branded invoices with sequential numbering, track partial and full payment, record balances and print or share branded PDF invoices.",
      },
      {
        name: "KRA eTIMS e-invoicing",
        description:
          "Submit invoices to the Kenya Revenue Authority's electronic Tax Invoice Management System and print the official control number and verification QR code on the invoice.",
      },
      {
        name: "Payment reminders",
        description:
          "Automatically remind customers by SMS and email when an invoice is overdue, using your own payment instructions, with a configurable interval and reminder cap.",
      },
      {
        name: "Bills & expenses",
        description:
          "Record supplier bills, utilities and recurring costs, track what has been paid, and keep operating expenses alongside income.",
      },
      {
        name: "Petty cash",
        description:
          "Manage an office float with vouchers, receipts and per-requestor spend limits, so you always know exactly how much cash remains and who spent it.",
      },
      {
        name: "Accounting",
        description:
          "A full double-entry ledger with chart of accounts, journal entries, trial balance, profit and loss and balance sheet, plus bank and M-Pesa reconciliation and VAT returns.",
      },
      {
        name: "Analytics & reports",
        description:
          "Payroll cost trends, leave utilisation, attendance rates, invoice ageing, cash flow and visitor footfall, with printable reports for management and KRA.",
      },
    ],
  },
  {
    id: "operations",
    title: "Day-to-day operations",
    summary:
      "The routine admin of running an office, so nothing depends on someone remembering.",
    modules: [
      {
        name: "Meetings",
        description:
          "Schedule meetings with attendees, agenda and location, notify invitees by SMS and email, and record decisions and actions.",
      },
      {
        name: "AI-generated minutes",
        description:
          "Turn meeting notes or a transcript into structured minutes, action points and owners using AI, then publish a branded printable document.",
      },
      {
        name: "Task management",
        description:
          "Assign tasks to staff with due dates and priority, let assignees report progress with photos and comments, and acknowledge or reopen completed work.",
      },
      {
        name: "Visitor management",
        description:
          "A digital visitor book capturing name, phone, host, purpose and vehicle registration, with check-in and sign-out times and footfall reports.",
      },
      {
        name: "Asset register & custody",
        description:
          "Track laptops, phones, vehicles and equipment with purchase value and serial numbers, plus a full checkout and return trail showing who holds each item.",
      },
      {
        name: "Vehicle log book",
        description:
          "Record vehicle trips with driver, destination, purpose and odometer readings, and print a log book for KRA tax allowances and audits.",
      },
      {
        name: "Requisitions",
        description:
          "Raise and approve petty cash and car log requisitions with printable branded forms.",
      },
    ],
  },
  {
    id: "platform",
    title: "Platform, branding & security",
    summary:
      "The infrastructure that keeps company data private, correctly branded and correctly notified.",
    modules: [
      {
        name: "Company branding",
        description:
          "Upload your logo and company details once, and they appear on every payslip, invoice, report, P9, requisition and PDF export. The KRA PIN is only ever shown on internal documents, never on customer invoices.",
      },
      {
        name: "SMS & email notifications",
        description:
          "Keep staff and customers informed automatically by SMS and email on leave decisions, payroll, invoices, payment reminders, document expiry and visitor sign-in.",
      },
      {
        name: "Two-factor authentication",
        description:
          "Protect every account with a 6-digit authenticator code at login, backed by single-use recovery codes.",
      },
      {
        name: "Roles & permissions",
        description:
          "Separate admin, secretary, manager and employee views, so staff only see the records and actions relevant to their role.",
      },
      {
        name: "Multi-company isolation",
        description:
          "Each company gets a completely private workspace — staff, requests, records and financial data are never shared between organisations.",
      },
      {
        name: "Works in any modern browser",
        description:
          "A responsive web app that runs on desktop, tablet and mobile, with printable documents and PDF exports for anything that needs signing or filing.",
      },
    ],
  },
];

/** Flat list of every module name, used for structured data. */
export const ALL_MODULE_NAMES: string[] = MODULE_GROUPS.flatMap((g) =>
  g.modules.map((m) => m.name),
);

export default function ModuleGrid() {
  return (
    <section
      id="modules"
      className="section scroll-mt-20 border-t border-white/5"
      aria-labelledby="modules-heading"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="eyebrow">Every module</p>
          <h2
            id="modules-heading"
            className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl"
          >
            One platform. Every part of the office.
          </h2>
          <p className="mt-4 text-zinc-400">
            Office Manager covers the full office lifecycle: people and HR, Kenyan statutory payroll,
            invoicing and KRA eTIMS tax filing, accounting, and day-to-day operations. No spreadsheets, no
            paperwork, no disconnected tools.
          </p>
        </div>

        <div className="mt-14 space-y-14">
          {MODULE_GROUPS.map((group) => (
            <div key={group.id} id={group.id}>
              <h3 className="text-xl font-semibold tracking-[-0.01em] text-white">{group.title}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{group.summary}</p>

              <ul className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                {group.modules.map((m) => (
                  <li key={m.name}>
                    <h4 className="text-sm font-semibold text-zinc-100">{m.name}</h4>
                    <p className="mt-1.5 text-sm leading-6 text-zinc-400">{m.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
