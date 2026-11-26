export interface Industry {
  slug: string;
  name: string;
  navLabel: string;
  icon: string;
  tagline: string;
  description: string;
  intro: string[];
  painPoints: string[];
  workflow: { title: string; body: string }[];
  modules: { slug: string; label: string; reason: string }[];
  guide?: { label: string; href: string };
  faqs: { q: string; a: string }[];
}

export const INDUSTRIES: Industry[] = [
  {
    slug: "retail",
    name: "Retail & shops",
    navLabel: "Retail",
    icon: "🛍️",
    tagline: "Invoices, cash and daily sales in one place",
    description:
      "Office Manager for Kenyan shops and retailers: invoicing, eTIMS-ready records, expenses, staff payroll and simple reporting.",
    intro: [
      "A retail business runs on small, frequent transactions. The risk is not one big error — it is the daily gap between what was sold, what was received and what was recorded. Over a month, those gaps become stock differences, unpaid invoices and VAT that does not reconcile.",
      "Office Manager gives a shop one workspace for sales documents, expenses, staff records and the ledger behind them. You keep the speed of a counter sale while building records that support eTIMS, payroll and month-end reporting.",
    ],
    painPoints: [
      "Cash sales and invoices recorded in different books, so the day never balances.",
      "VAT and eTIMS obligations handled late or manually.",
      "Shop staff payroll, leave and advances tracked separately from the accounts.",
      "No reliable view of expenses by branch, category or month.",
    ],
    workflow: [
      {
        title: "Record the sale",
        body: "Raise an invoice or record the transaction against the customer, with the correct VAT treatment. Paid and unpaid sales post to the ledger instead of sitting in a separate list.",
      },
      {
        title: "Track expenses and petty cash",
        body: "Capture supplier bills, transport, utilities and petty cash requisitions with an approver and a receipt trail, so the true cost of trading is visible.",
      },
      {
        title: "Run payroll for the team",
        body: "Calculate PAYE, NSSF, SHIF, the Housing Levy and HELB from current rules, then issue digital payslips to shop staff and management.",
      },
      {
        title: "Review the month",
        body: "Use the ledger and reports to check sales, expenses, receivables and VAT before filing. Export what your accountant needs instead of rebuilding a spreadsheet.",
      },
    ],
    modules: [
      { slug: "invoicing", label: "Invoicing", reason: "Issue invoices and track what customers owe." },
      { slug: "etims", label: "KRA eTIMS", reason: "Keep compliant invoice records with control numbers." },
      { slug: "accounting", label: "Accounting", reason: "Post sales and expenses to one double-entry ledger." },
      { slug: "payroll", label: "Payroll", reason: "Pay shop staff and management accurately." },
      { slug: "petty-cash", label: "Petty cash", reason: "Control day-to-day cash with approvals." },
      { slug: "assets", label: "Assets", reason: "Track fridges, shelving, POS hardware and vehicles." },
    ],
    guide: {
      label: "KRA eTIMS checklist for small businesses",
      href: "/resources/kra-etims-checklist",
    },
    faqs: [
      {
        q: "Can a shop use Office Manager without a full finance team?",
        a: "Yes. The invoicing and expense flows are designed for busy operators, while the ledger runs in the background. Many small businesses start with invoicing, expenses and payroll before adding deeper accounting.",
      },
      {
        q: "Does it support VAT and eTIMS?",
        a: "Invoices can carry the VAT treatment you configure, and the eTIMS module keeps compliant invoice records including control numbers. Confirm your specific obligations with KRA or your tax adviser.",
      },
      {
        q: "Can we track more than one shop?",
        a: "Each business is a separate workspace. If you operate multiple legal entities, each can have its own workspace. Ask us about the right structure for branches within one entity.",
      },
    ],
  },
  {
    slug: "logistics",
    name: "Logistics & fleet",
    navLabel: "Logistics",
    icon: "🚚",
    tagline: "Vehicles, fuel, repairs and drivers under control",
    description:
      "Office Manager for logistics and fleet operators: vehicle logs, fuel and repair costs, driver records, documents and payroll.",
    intro: [
      "Fleet costs leak quietly. A fuel fill-up with no odometer reading, a repair with no invoice, a driver with no licence record — none of these looks urgent on its own, but together they make cost-per-kilometre impossible to trust.",
      "Office Manager gives fleet operators a structured record for each vehicle and each trip, linked to the same ledger used for invoices, expenses and payroll. You can see what a vehicle earns, what it costs and what needs attention.",
    ],
    painPoints: [
      "Fuel and repair costs recorded in notebooks or WhatsApp.",
      "No odometer or trip history to compare vehicles fairly.",
      "Driver licences, contracts and vehicle documents expiring unnoticed.",
      "Vehicle costs disconnected from the accounting ledger.",
    ],
    workflow: [
      {
        title: "Log every trip and fill-up",
        body: "Record the vehicle, driver, date, distance and fuel cost. A consistent log turns scattered receipts into cost-per-kilometre and utilisation figures.",
      },
      {
        title: "Capture maintenance and repairs",
        body: "Attach the repair cost and supplier to the vehicle so maintenance is visible per vehicle rather than buried in general expenses.",
      },
      {
        title: "Keep documents current",
        body: "Store insurance, inspection, licences and contracts with expiry dates, so renewals are handled before they become fines or downtime.",
      },
      {
        title: "Bill and pay from one ledger",
        body: "Invoice clients for haulage or services, record driver and office payroll, and let expenses post to the same accounts your accountant reviews.",
      },
    ],
    modules: [
      { slug: "car-logs", label: "Car logs", reason: "Trips, fuel, mileage and repair history per vehicle." },
      { slug: "assets", label: "Assets", reason: "Track vehicles, trailers and equipment." },
      { slug: "documents", label: "Documents", reason: "Insurance, inspections, licences and contracts." },
      { slug: "accounting", label: "Accounting", reason: "See fleet costs alongside revenue." },
      { slug: "payroll", label: "Payroll", reason: "Pay drivers and office staff correctly." },
      { slug: "petty-cash", label: "Petty cash", reason: "Approve roadside and depot spending." },
    ],
    faqs: [
      {
        q: "Can we record fuel and repairs per vehicle?",
        a: "Yes. Car logs keep a per-vehicle history of trips, mileage, fuel and maintenance, so you can compare vehicles and spot unusual costs.",
      },
      {
        q: "Does it track driver documents?",
        a: "Documents can be stored with expiry dates, including driving licences, insurance and inspections. You can review what is due before it lapses.",
      },
      {
        q: "Can we invoice clients for trips?",
        a: "Yes. Invoicing and accounting are part of the same workspace, so haulage and service revenue sit alongside fleet costs.",
      },
    ],
  },
  {
    slug: "clinics",
    name: "Clinics & health centres",
    navLabel: "Clinics",
    icon: "🏥",
    tagline: "Patients, consultations and billing without the paper chase",
    description:
      "Office Manager for Kenyan clinics and health centres: patient records, consultation fees linked to accounting, Excel import and printable statements.",
    intro: [
      "A clinic needs two things to run smoothly: a reliable patient record and a reliable record of what was paid. When those live in different books, the clinical history and the financial history drift apart.",
      "The healthcare add-on brings a patient register and consultation billing into the same workspace as payroll, expenses and accounting. Patient numbers stay consistent, consultation fees post to the ledger, and statements can be printed or exported when a patient asks.",
    ],
    painPoints: [
      "Patient details repeated across paper files and spreadsheets.",
      "Consultation fees collected but not reflected in the accounts.",
      "Duplicate patient records splitting a history.",
      "Ages missing or inaccurate when dates of birth are unknown.",
    ],
    workflow: [
      {
        title: "Register the patient once",
        body: "Capture name, phone, gender, date of birth or age, and notes. A permanent patient number links every future visit.",
      },
      {
        title: "Record the consultation",
        body: "Add the visit date, procedure, clinician and fee. Paid visits post to cash, bank or M-Pesa; unpaid visits post to accounts receivable.",
      },
      {
        title: "Keep the ledger accurate",
        body: "Edits and deletions reverse and re-post the original journal, so the accounts stay auditable instead of silently changing.",
      },
      {
        title: "Report and share",
        body: "Print or export patient registers, consultation registers and patient statements for review, claims or handover.",
      },
    ],
    modules: [
      { slug: "healthcare", label: "Healthcare", reason: "Patient records, consultations and statements." },
      { slug: "accounting", label: "Accounting", reason: "Consultation fees post to a real ledger." },
      { slug: "payroll", label: "Payroll", reason: "Pay clinicians and support staff." },
      { slug: "documents", label: "Documents", reason: "Policies, licences and staff records." },
      { slug: "leave", label: "Leave", reason: "Manage clinical rosters and leave." },
    ],
    guide: {
      label: "How to build a patient register in Excel",
      href: "/resources/patient-register-excel-template",
    },
    faqs: [
      {
        q: "Is the healthcare module included in every plan?",
        a: "It is an opt-in add-on for clinics and hospitals. Contact us for add-on pricing and to confirm the right plan for your team size.",
      },
      {
        q: "Can we import our existing patient list?",
        a: "Yes. The importer accepts patient and consultation registers from Excel or CSV, with a preview and duplicate detection before records are saved.",
      },
      {
        q: "Does it handle patients without a date of birth?",
        a: "Yes. You can record an age and the date it was recorded when the date of birth is unknown. When a date of birth is provided, it takes precedence.",
      },
      {
        q: "Can we print a patient statement?",
        a: "Yes. Patient statements and consultation registers can be printed or exported for sharing and record-keeping.",
      },
    ],
  },
  {
    slug: "ngos",
    name: "NGOs & non-profits",
    navLabel: "NGOs",
    icon: "🤝",
    tagline: "Programme spending, approvals and records that stand up to audit",
    description:
      "Office Manager for NGOs and non-profits: controlled spending, document trails, asset registers, leave and reporting.",
    intro: [
      "Donor-funded organisations are asked to prove things: that a payment was approved, that an asset exists, that leave was authorised, that a document is the current version. If those answers depend on one person's inbox, every audit becomes a scramble.",
      "Office Manager gives programme and finance teams a shared record with approvals and history. Spending is captured with a reason and an approver, documents have an owner, and assets have a custodian.",
    ],
    painPoints: [
      "Approvals given verbally or in chat with no durable record.",
      "Programme spending mixed with administration costs.",
      "Assets donated or purchased without a maintained register.",
      "Documents, policies and contracts scattered across drives.",
    ],
    workflow: [
      {
        title: "Request and approve spending",
        body: "Petty cash and expenses are raised with an amount and reason, then approved or declined by the responsible person. The decision stays on record.",
      },
      {
        title: "Separate and report costs",
        body: "Use accounts and reports to distinguish programme, administration and fundraising costs, and to prepare the figures donors request.",
      },
      {
        title: "Maintain an asset register",
        body: "Record each asset with a tag, location, custodian and condition, so physical verification is straightforward.",
      },
      {
        title: "Keep people records consistent",
        body: "Manage leave, staff documents and payroll in the same workspace, with role-based access for programme and finance teams.",
      },
    ],
    modules: [
      { slug: "petty-cash", label: "Petty cash", reason: "Request, approve and reconcile programme spending." },
      { slug: "accounting", label: "Accounting", reason: "Report income and costs by category." },
      { slug: "assets", label: "Assets", reason: "A verifiable register for donated and purchased items." },
      { slug: "documents", label: "Documents", reason: "Policies, contracts and donor files with owners." },
      { slug: "leave", label: "Leave", reason: "Transparent approvals for staff and volunteers." },
      { slug: "meetings", label: "Meetings", reason: "Agendas, minutes and decisions in one place." },
    ],
    faqs: [
      {
        q: "Can different teams have different access?",
        a: "Yes. Access is role-based, with custom roles and per-module permissions, so programme, finance and leadership teams can each see what they need.",
      },
      {
        q: "Does it help with donor reporting?",
        a: "The accounting module gives you categorised income and expenditure that you can report from. Specific donor templates may still need preparation outside the system.",
      },
      {
        q: "Can we keep an audit trail of approvals?",
        a: "Yes. Significant actions and approval decisions are recorded with the user and time, so you can review who approved what.",
      },
    ],
  },
  {
    slug: "professional-services",
    name: "Professional services",
    navLabel: "Professional services",
    icon: "💼",
    tagline: "Bill clients, run projects and keep the books straight",
    description:
      "Office Manager for consultancies, agencies and professional firms: invoicing, eTIMS, expense control, client records and team tasks.",
    intro: [
      "Professional firms sell expertise, so the two things that matter most are billable work and clean client records. When proposals, tasks, invoices and expenses live in different tools, it is hard to know which engagements are profitable.",
      "Office Manager connects client records, invoicing, expenses and internal tasks in one workspace. Invoices post to the ledger, expenses are approved with a trail, and the team can see what is due without another status meeting.",
    ],
    painPoints: [
      "Client history spread across inboxes, spreadsheets and personal notes.",
      "Invoices raised late or without a clear payment status.",
      "Expenses and disbursements reimbursed without a proper record.",
      "No single view of active work and outstanding client balances.",
    ],
    workflow: [
      {
        title: "Keep clients in a CRM",
        body: "Record contacts, conversations and opportunities against one client profile, so handovers and follow-ups do not depend on memory.",
      },
      {
        title: "Assign and track work",
        body: "Create tasks with owners and due dates. Team members report progress in the same place instead of scattered updates.",
      },
      {
        title: "Invoice and follow up",
        body: "Raise invoices with the correct VAT treatment, post them to the ledger, and see what is unpaid before month end.",
      },
      {
        title: "Control disbursements",
        body: "Capture expenses and petty cash with approvals and receipts, then reimburse or recharge them with confidence.",
      },
    ],
    modules: [
      { slug: "crm", label: "CRM", reason: "One client profile for contacts and opportunities." },
      { slug: "tasks", label: "Tasks", reason: "Assign work, due dates and progress reports." },
      { slug: "invoicing", label: "Invoicing", reason: "Bill clients and track receivables." },
      { slug: "etims", label: "KRA eTIMS", reason: "Keep compliant invoice records." },
      { slug: "accounting", label: "Accounting", reason: "A ledger behind every invoice and expense." },
      { slug: "documents", label: "Documents", reason: "Proposals, contracts and deliverables." },
    ],
    guide: {
      label: "Office management software buyer's checklist",
      href: "/resources/office-management-software-checklist",
    },
    faqs: [
      {
        q: "Can we track time or bill by project?",
        a: "Tasks and client records keep work organised. Billing is invoice-based; if you need detailed timesheets, confirm your requirements with us during onboarding.",
      },
      {
        q: "Does it support retainer invoicing?",
        a: "You can raise recurring invoices manually each period with consistent line items. Ask us about automating a specific retainer workflow.",
      },
      {
        q: "Can partners see different clients?",
        a: "Access is role-based with custom roles and module permissions. Client visibility can be scoped according to how your firm is structured, subject to the permissions available.",
      },
    ],
  },
];

export function getIndustry(slug: string) {
  return INDUSTRIES.find((industry) => industry.slug === slug);
}
