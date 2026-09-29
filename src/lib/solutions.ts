export interface Solution {
  slug: string;
  title: string;
  navLabel: string;
  icon: string;
  tagline: string;
  summary: string;
  features: string[];
}

export const SOLUTIONS: Solution[] = [
  {
    slug: "payroll",
    title: "Payroll",
    navLabel: "Payroll",
    icon: "💰",
    tagline: "KRA-compliant payroll in minutes, not days",
    summary:
      "Set up your payroll run, and Office Manager automatically computes statutory deductions — PAYE, NSSF, SHIF, Affordable Housing Levy and optional HELB — straight from the latest KRA rules. Review the run, approve it, and every employee instantly receives a secure digital payslip by email and SMS. No spreadsheets, no manual tax tables.",
    features: [
      "Automatic PAYE, NSSF, SHIF and Housing Levy calculation",
      "One-click monthly payroll runs with a full audit trail",
      "Digital payslips delivered to employees by email and SMS",
      "Leave and allowance balances feed directly into each run",
    ],
  },
  {
    slug: "leave",
    title: "Leave Management",
    navLabel: "Leave",
    icon: "🌴",
    tagline: "Apply and approve leave in one tap",
    summary:
      "Employees apply for annual, sick, bereavement, maternity, paternity or any custom leave in seconds. The right manager is notified instantly and approves or rejects with a single tap. Leave balances update automatically, the request history is fully audited, and the whole team is kept informed by SMS and email.",
    features: [
      "Self-service leave applications for every employee type",
      "Single-tap approvals with automatic balance updates",
      "Manager and requester notified by SMS and email",
      "Complete audit trail of every request and decision",
    ],
  },
  {
    slug: "petty-cash",
    title: "Petty Cash",
    navLabel: "Petty Cash",
    icon: "💵",
    tagline: "Requisitions, approvals and records that add up",
    summary:
      "Team members raise petty cash requisitions with an amount and reason, and the responsible approver accepts or declines them instantly. Every approved request is recorded against your petty cash fund, so you always know how much is outstanding, spent or available — with a clean, audit-ready trail.",
    features: [
      "Fast requisition requests with reason and amount",
      "Instant approvals keep the fund moving without delays",
      "Running balance of allocated, spent and remaining cash",
      "Reports that make reconciliation simple and transparent",
    ],
  },
  {
    slug: "car-logs",
    title: "Car Logs",
    navLabel: "Car Logs",
    icon: "🚗",
    tagline: "Repairs, insurance and servicing in one ledger",
    summary:
      "Log every vehicle — repairs, servicing, fuel, insurance and mileage — in a single, organised ledger. Assign vehicles to drivers, track maintenance schedules and insurance renewals, and keep a complete history for every car in your fleet, so nothing slips through the cracks.",
    features: [
      "Per-vehicle records for repairs, servicing, fuel and mileage",
      "Track insurance renewals and servicing schedules",
      "Assign vehicles to drivers and maintain full history",
      "Spend summaries that feed your reporting",
    ],
  },
  {
    slug: "meetings",
    title: "Meetings & AI Minutes",
    navLabel: "Meetings",
    icon: "📅",
    tagline: "Schedule meetings and recap them automatically",
    summary:
      "Set up meetings with an agenda and attendees, and Office Manager handles the follow-through. AI automatically summarises the discussion into clear minutes — action items, decisions and owners — so your team stays aligned and no decisions get lost after the meeting ends.",
    features: [
      "Meetings with agendas, attendees and reminders",
      "AI-generated minutes that capture decisions and owners",
      "Action items tracked so follow-through actually happens",
      "Minutes instantly available to everyone who attended",
    ],
  },
  {
    slug: "invoicing",
    title: "Invoicing & Bills",
    navLabel: "Invoicing",
    icon: "🧾",
    tagline: "VAT invoices and supplier bills, handled",
    summary:
      "Create professional VAT invoices for your clients in a couple of clicks, track suppliers' bills, and see exactly what you're owed and what you owe. Keep statuses clear — draft, sent, paid and overdue — so your cash flow is always in view.",
    features: [
      "Professional VAT invoices built quickly and easily",
      "Track supplier bills and what you owe at a glance",
      "Clear invoice statuses — draft, sent, paid, overdue",
      "Receivables and payables that keep your cash flow visible",
    ],
  },
];

export function getSolution(slug: string): Solution | undefined {
  return SOLUTIONS.find((s) => s.slug === slug);
}
