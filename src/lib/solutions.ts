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
  {
    slug: "accounting",
    title: "Accounting & Ledgers",
    navLabel: "Accounting",
    icon: "📒",
    tagline: "A real double-entry ledger, not a spreadsheet",
    summary:
      "Keep every invoice, bill, payment, receipt and expense in one double-entry ledger. See your trial balance, profit and loss, balance sheet, VAT and cash flow without rebuilding spreadsheets at month end.",
    features: [
      "Double-entry general ledger with a configurable chart of accounts",
      "Invoices, bills, payments, receipts and credit notes",
      "Bank and M-Pesa reconciliation",
      "Trial balance, P&L, balance sheet, VAT and management reports",
    ],
  },
  {
    slug: "etims",
    title: "KRA eTIMS e-Invoicing",
    navLabel: "eTIMS",
    icon: "🛡️",
    tagline: "Submit invoices to KRA without leaving the invoice screen",
    summary:
      "Generate VAT invoices and submit them to KRA's electronic Tax Invoice Management System (eTIMS). Office Manager stores the control number, prints the official verification QR code and lets you retry safely if a submission fails.",
    features: [
      "One-click submission from an invoice",
      "Stores KRA control numbers and verification QR codes",
      "Retry-safe if KRA is temporarily unavailable",
      "VAT invoices and credit notes in one flow",
    ],
  },
  {
    slug: "attendance",
    title: "Attendance & Time Clock",
    navLabel: "Attendance",
    icon: "⏱️",
    tagline: "Know who is in, late or away",
    summary:
      "One-tap clock-in and clock-out for employees, with configurable working hours, grace periods and late detection. Managers get monthly attendance summaries, and casual staff can be tracked separately.",
    features: [
      "One-tap clock-in and clock-out",
      "Configurable working hours, grace period and late detection",
      "Monthly attendance summaries per employee",
      "Separate casual attendance tracking",
    ],
  },
  {
    slug: "visitors",
    title: "Visitor Management",
    navLabel: "Visitors",
    icon: "🛎️",
    tagline: "A digital visitor book with host alerts",
    summary:
      "Register every visitor with name, phone, host, purpose and vehicle registration. The host is notified, reception can check them in and out, and footfall reports are ready when you need them.",
    features: [
      "Digital visitor book with searchable history",
      "Host notifications when a visitor arrives",
      "Check-in and sign-out trail",
      "Visitor footfall reports",
    ],
  },
  {
    slug: "assets",
    title: "Asset Register & Custody",
    navLabel: "Assets",
    icon: "📦",
    tagline: "Know what you own and who has it",
    summary:
      "Track laptops, phones, furniture, vehicles and equipment with purchase value, serial numbers and custody. Check items out to staff, log returns and keep a full movement history for audits.",
    features: [
      "Asset register with values and serial numbers",
      "Checkout and return to staff members",
      "Custody and movement history",
      "Audit-ready asset reports",
    ],
  },
  {
    slug: "documents",
    title: "Document Management",
    navLabel: "Documents",
    icon: "📁",
    tagline: "Contracts, IDs and permits in one place",
    summary:
      "Store contracts, IDs, work permits, medical cards and certificates against each employee. Automatic expiry reminders tell you before a document lapses, and access is controlled by role.",
    features: [
      "Employee document register",
      "Expiry reminders before documents lapse",
      "Role-based access to sensitive files",
      "Secure cloud storage",
    ],
  },
  {
    slug: "crm",
    title: "CRM & Sales Pipeline",
    navLabel: "CRM",
    icon: "🤝",
    tagline: "Leads, deals and follow-ups in one view",
    summary:
      "Capture leads, manage companies and contacts, move deals through pipelines and send quotations from one place. Email integration and follow-up automation keep the team on top of every opportunity.",
    features: [
      "Companies, contacts and leads",
      "Pipelines and deal stages",
      "Quotations that convert into invoices",
      "Email integration and follow-up automation",
    ],
  },
  {
    slug: "tasks",
    title: "Tasks & Accountability",
    navLabel: "Tasks",
    icon: "✅",
    tagline: "Assign work and see it through",
    summary:
      "Assign tasks with owners, due dates and priority. Staff report progress with comments and photos; managers acknowledge completed work or reopen it, so nothing gets lost in chat.",
    features: [
      "Assign tasks with due dates and priority",
      "Progress updates with photos and comments",
      "Acknowledge or reopen completed work",
      "Task reports for managers",
    ],
  },
  {
    slug: "healthcare",
    title: "Clinics & Patient Consultations",
    navLabel: "Healthcare",
    icon: "🩺",
    tagline: "Patient records that post to your ledger",
    summary:
      "Register patients, record consultations and fees, and keep a full visit history. Every fee posts to the accounting ledger automatically, unpaid visits show as receivables, and existing Excel registers can be imported.",
    features: [
      "Patient register and full visit history",
      "Consultation fees posted to accounting automatically",
      "Paid/unpaid tracking with outstanding balances",
      "Excel import and printable patient statements",
    ],
  },
];

export function getSolution(slug: string): Solution | undefined {
  return SOLUTIONS.find((s) => s.slug === slug);
}
