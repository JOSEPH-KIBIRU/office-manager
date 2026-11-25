export interface GuideSection {
  heading: string;
  body: string[];
  bullets?: string[];
}

export interface GuideFaq {
  q: string;
  a: string;
}

export interface Guide {
  slug: string;
  title: string;
  description: string;
  category: string;
  readingTime: string;
  updated: string;
  intro: string;
  sections: GuideSection[];
  faqs: GuideFaq[];
  relatedSolutions: string[];
}

/**
 * Long-form guides. Each guide is a static, indexable page with Article and
 * FAQ structured data, and links back to the relevant solution pages.
 */
export const GUIDES: Guide[] = [
  {
    slug: "payroll-kenya-guide",
    title: "How to Run Payroll in Kenya: A Practical Guide for SMEs",
    description:
      "A practical guide to running payroll in Kenya: employee records, statutory deductions, approvals, payslips and record-keeping for small teams.",
    category: "Payroll",
    readingTime: "7 min read",
    updated: "2026-11-25",
    intro:
      "Payroll in Kenya is more than multiplying a salary by the days worked. You need accurate employee records, the right statutory treatments, a clear approval trail and payslips your team can trust. This guide walks through a repeatable monthly process — and shows where software can remove the manual work.",
    sections: [
      {
        heading: "1. Start with clean employee records",
        body: [
          "Every payroll run is only as accurate as the records behind it. Before the first run, make sure every employee has a complete profile and that changes are captured as they happen, not reconstructed at month end.",
        ],
        bullets: [
          "Legal name, employee number, role, department and employment type.",
          "KRA PIN, NSSF number, SHIF number and any other statutory identifiers.",
          "Bank account or M-Pesa number used for salary payment.",
          "Basic salary, allowances, benefits and any recurring deductions.",
          "Start date, leave balance and any staff loan or advance balance.",
        ],
      },
      {
        heading: "2. Calculate gross pay and statutory deductions",
        body: [
          "Gross pay usually combines basic salary with allowances, overtime, per diem, commissions or leave encashment. Statutory deductions are then applied according to current Kenyan rules.",
          "PAYE, NSSF, SHIF, the Affordable Housing Levy and HELB (where applicable) should be calculated from one central configuration rather than copied between spreadsheets. Rates, bands and thresholds change, so confirm the current rules with KRA and the relevant agencies before each payroll cycle.",
        ],
        bullets: [
          "Keep taxable and non-taxable allowances clearly separated.",
          "Calculate employer contributions separately from employee deductions.",
          "Handle new hires, leavers and salary changes from an effective date.",
          "Keep casual or daily-rate staff in a separate, auditable process.",
        ],
      },
      {
        heading: "3. Review before anyone is paid",
        body: [
          "A second pair of eyes prevents expensive mistakes. Review the run against the previous month and investigate large variances before approving payment.",
        ],
        bullets: [
          "Compare headcount, gross pay and net pay with the prior run.",
          "Check new hires, leavers, unpaid leave and overtime.",
          "Confirm statutory totals and employer contributions.",
          "Record who approved the run and when.",
        ],
      },
      {
        heading: "4. Issue payslips and keep records",
        body: [
          "Employees should receive a clear payslip showing gross pay, deductions, employer contributions and net pay. Keep the payroll register, statutory schedules and approvals together so you can answer questions and support filings.",
          "At year end, employees need a P9. During the year, statutory returns and payment evidence should be filed consistently. A digital record is easier to search, back up and audit than a folder of spreadsheets.",
        ],
      },
      {
        heading: "5. Common payroll mistakes to avoid",
        bullets: [
          "Using last month's spreadsheet without checking new hires or leavers.",
          "Manual formula edits that are not visible to anyone else.",
          "Treating all allowances the same for tax purposes.",
          "Approving a run without a variance review.",
          "No record of who changed a salary or approved a payment.",
        ],
        body: [
          "Most payroll errors are process errors, not arithmetic errors. A consistent checklist and an audit trail solve more problems than another spreadsheet formula.",
        ],
      },
      {
        heading: "6. Where Office Manager helps",
        body: [
          "Office Manager keeps employee records, payroll runs, statutory deductions, payslips and P9 data in one workspace. Payroll is calculated from a central configuration, payslips can be delivered by email and SMS, and every run keeps an approval trail.",
        ],
        bullets: [
          "PAYE, NSSF, SHIF, Housing Levy and HELB in one payroll run.",
          "Casuals, overtime, per diem, staff loans and leave encashment.",
          "Digital payslips and year-end P9 support.",
          "Role-based access and an audit trail for changes.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does Office Manager calculate Kenyan statutory deductions?",
        a: "Yes. PAYE, NSSF, SHIF, the Affordable Housing Levy and optional HELB are calculated from a central payroll configuration. Because rates and thresholds change, confirm the current rules with KRA and the relevant agencies.",
      },
      {
        q: "Can I run payroll for casual staff?",
        a: "Yes. Casual attendance and pay can be tracked separately from permanent payroll, then included in the payroll process where appropriate.",
      },
      {
        q: "Are payslips sent to employees?",
        a: "Yes. Digital payslips can be delivered by email and SMS, and employees can also access their payslips in their own portal.",
      },
    ],
    relatedSolutions: ["payroll", "leave", "attendance", "documents"],
  },
  {
    slug: "kra-etims-checklist",
    title: "KRA eTIMS Invoice Checklist for Kenyan SMEs",
    description:
      "A practical KRA eTIMS checklist: invoice details, submission, control numbers, credit notes, common failures and keeping an audit trail.",
    category: "Compliance",
    readingTime: "6 min read",
    updated: "2026-11-25",
    intro:
      "KRA's electronic Tax Invoice Management System (eTIMS) changes how VAT invoices are issued and verified. A reliable process captures the right details, submits invoices consistently and keeps evidence of every response. This checklist covers the practical steps.",
    sections: [
      {
        heading: "1. Know which sales need an eTIMS invoice",
        body: [
          "Not every transaction is treated the same. VATable supplies, zero-rated supplies, exempt supplies and credit notes can have different requirements. Check the current KRA guidance for your business and confirm whether your buyers expect an eTIMS control number on the invoice.",
          "If you are unsure about a specific transaction, ask your accountant or KRA before changing how you invoice. A consistent policy is easier to audit than a case-by-case guess.",
        ],
      },
      {
        heading: "2. Capture the right invoice details",
        body: [
          "Most eTIMS failures start with missing or inconsistent invoice data. Build a checklist that every invoice must pass before submission.",
        ],
        bullets: [
          "Seller KRA PIN, business name and invoice number.",
          "Buyer name and KRA PIN where required.",
          "Invoice date, description, quantity, unit price and line totals.",
          "VAT rate, VAT amount and invoice total.",
          "Payment terms or method, where relevant.",
        ],
      },
      {
        heading: "3. Submit and store the response",
        body: [
          "After submission, store the control number, QR code, status and timestamp against the invoice. The QR code lets a buyer verify the invoice, and the stored response is your evidence if a question arises later.",
          "If a submission fails, retry safely. Do not delete the invoice or issue a duplicate with a new number unless your process explicitly requires it — duplicated invoices create reconciliation problems.",
        ],
      },
      {
        heading: "4. Handle credit notes and corrections",
        body: [
          "When an invoice needs to be corrected or reversed, issue a credit note linked to the original invoice. Keep the reason, amounts and tax treatment clear. Never silently edit a submitted invoice or reuse an invoice number.",
        ],
      },
      {
        heading: "5. Common eTIMS problems to watch",
        bullets: [
          "Missing or incorrect buyer KRA PIN.",
          "Wrong VAT treatment on the invoice line.",
          "Duplicate invoice numbers across branches or systems.",
          "Submitting from multiple tools with no single audit trail.",
          "No stored control number or QR code after submission.",
        ],
        body: [
          "The goal is not only to submit — it is to be able to prove what was submitted, when, and for which invoice.",
        ],
      },
      {
        heading: "6. Where Office Manager helps",
        body: [
          "Office Manager generates VAT invoices, submits them to eTIMS from the invoice screen and stores the returned control number and verification QR code. A failed submission does not block invoicing, so you can retry without losing the sale.",
        ],
        bullets: [
          "One-click eTIMS submission from an invoice.",
          "Control numbers and QR codes stored with the invoice.",
          "Credit notes and corrections linked to the original.",
          "The same invoice posts to the accounting ledger automatically.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does Office Manager submit invoices to KRA eTIMS?",
        a: "Yes. You can submit a VAT invoice from the invoice screen. Office Manager stores the returned control number and prints the eTIMS verification QR code on the invoice.",
      },
      {
        q: "What happens if KRA eTIMS is unavailable?",
        a: "A submission failure does not block invoicing. You can continue issuing the invoice and retry the eTIMS submission safely.",
      },
      {
        q: "Can I still issue credit notes?",
        a: "Yes. Credit notes are linked to the original invoice and keep the correction trail clear for accounting and audit.",
      },
    ],
    relatedSolutions: ["etims", "invoicing", "accounting"],
  },
  {
    slug: "excel-import-guide",
    title: "How to Move Your Excel Records Into Office Manager",
    description:
      "A practical guide to preparing Excel or CSV records, cleaning dates and amounts, avoiding duplicates, testing an import and reconciling totals.",
    category: "Getting started",
    readingTime: "6 min read",
    updated: "2026-11-25",
    intro:
      "Migrating from spreadsheets is often the biggest worry when adopting a new system. You do not need to retype years of records. A little preparation makes the import predictable — and a test import catches most problems before they reach your live data.",
    sections: [
      {
        heading: "1. Start with a clean export",
        body: [
          "Export one record type per sheet and keep a single header row at the top. Remove merged cells, totals rows and decorative headings before you import.",
        ],
        bullets: [
          "One table per sheet, with a clear header row.",
          "No merged cells in the data area.",
          "Consistent date formats and no text in numeric columns.",
          "Remove blank columns and rows before the header.",
        ],
      },
      {
        heading: "2. Use the template and map your columns",
        body: [
          "A template removes guesswork. Map your existing columns to the required fields, then check optional fields such as phone, email, gender, date of birth, notes or payment status.",
          "If a column does not match a template field, leave it out or move the information into a notes field. Do not combine two values — such as a name and a phone number — into one column.",
        ],
      },
      {
        heading: "3. Clean the data before importing",
        bullets: [
          "Dates: use YYYY-MM-DD or DD/MM/YYYY consistently.",
          "Amounts: remove currency symbols, spaces and thousands separators.",
          "Phone numbers: keep a consistent format and avoid text prefixes.",
          "Gender and payment fields: use the accepted values in the template.",
          "Duplicates: decide whether a patient or contact is matched by number, phone or name.",
        ],
        body: [
          "The importer previews every row before committing. Use that preview to catch invalid dates, missing required fields and duplicate patients.",
        ],
      },
      {
        heading: "4. Run a small test import first",
        body: [
          "Start with five to ten representative rows. Preview the file, fix any row-level errors, then import the small batch. Check the records in the system, then import the full file once the process is proven.",
        ],
      },
      {
        heading: "5. Reconcile totals after the import",
        body: [
          "Compare the number of records and key totals before and after the import. For patient records, compare visit counts and outstanding balances. Keep the original spreadsheet as a reference until you are satisfied with the migrated data.",
        ],
      },
      {
        heading: "6. What the built-in importer supports",
        body: [
          "The built-in Excel/CSV importer supports patient registers and consultation history, including duplicate detection and a preview before commit. Imported consultations post to the accounting ledger like manually captured visits.",
          "For other record types, our onboarding team can help map and verify the data before go-live. Always take a backup or keep the original file before a large import.",
        ],
      },
    ],
    faqs: [
      {
        q: "What file types can I import?",
        a: "Excel .xlsx or .xlsm files and CSV/TSV files are supported. Legacy .xls files should be saved as .xlsx or CSV first.",
      },
      {
        q: "What happens to duplicate patients?",
        a: "Patients are matched by patient number, then phone, then full name. Existing matches are skipped instead of creating duplicates.",
      },
      {
        q: "What if some rows fail?",
        a: "The preview shows row-level errors before you commit. Fix those rows in the spreadsheet and re-import; valid rows can still be imported.",
      },
    ],
    relatedSolutions: ["healthcare", "accounting"],
  },
  {
    slug: "leave-policy-guide",
    title: "Leave Management Policy Basics for Kenyan SMEs",
    description:
      "A practical guide to leave types, entitlement, carry-over, approvals, shared calendars and records for a small Kenyan team.",
    category: "HR",
    readingTime: "5 min read",
    updated: "2026-11-25",
    intro:
      "A clear leave policy prevents disputes and keeps payroll predictable. The goal is not a complicated rulebook — it is a small set of decisions everyone understands, recorded in one place.",
    sections: [
      {
        heading: "1. Decide your leave types and entitlement",
        body: [
          "Start with the leave types your team actually uses: annual, sick, maternity, paternity, bereavement, compassionate and unpaid leave. Align at least the statutory minimums with current employment law and your contracts, then decide whether to offer more.",
        ],
        bullets: [
          "Annual leave and how it accrues.",
          "Sick leave and what evidence is required.",
          "Maternity, paternity and compassionate leave.",
          "Unpaid leave and its effect on payroll.",
        ],
      },
      {
        heading: "2. Set carry-over and encashment rules",
        body: [
          "Decide how much unused annual leave carries into the next year, when it expires, and whether any balance can be paid out. Put the cap and the payout rule in writing so payroll can apply it consistently.",
        ],
      },
      {
        heading: "3. Make approvals clear",
        body: [
          "Name the approver for each team or department, set an expected response time, and decide what happens when the approver is away. Employees should know who to ask and how quickly to expect an answer.",
        ],
      },
      {
        heading: "4. Keep a shared leave calendar",
        body: [
          "A shared calendar shows who is away and helps teams plan cover. It also reduces clashes during busy periods. Look for a calendar that includes approved and pending leave, not just a list of requests.",
        ],
      },
      {
        heading: "5. Keep records payroll can use",
        body: [
          "Every request and decision should be recorded: dates, days, type, approver and any note. At year end, the balance should reset or carry over according to your policy, and any encashment should flow into payroll.",
        ],
      },
      {
        heading: "6. Where Office Manager helps",
        body: [
          "Employees apply in the workspace, managers approve with one tap, and balances update automatically. Working-day deduction skips weekends and public holidays, and a shared calendar keeps the team informed.",
        ],
        bullets: [
          "Self-service leave requests and approvals.",
          "Working-day deduction and public-holiday awareness.",
          "Shared leave calendar and notifications by SMS/email.",
          "Configurable carry-over and year-end encashment.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can employees see their leave balance?",
        a: "Yes. Employees can see their balance and request history in their workspace, and managers see the same records for their team.",
      },
      {
        q: "Does leave calculate working days?",
        a: "Yes. Working-day deduction can skip weekends and configured public holidays, rather than counting calendar days.",
      },
      {
        q: "Can unused leave be paid out?",
        a: "Yes, if your policy allows it. Carry-over caps and end-of-year encashment are configurable, and encashable days can flow into payroll.",
      },
    ],
    relatedSolutions: ["leave", "payroll", "attendance"],
  },
  {
    slug: "office-management-software-checklist",
    title: "How to Choose Office Management Software in Kenya: A Buyer's Checklist",
    description:
      "A practical buyer's checklist for office management software in Kenya: payroll compliance, accounting depth, permissions, data isolation and onboarding.",
    category: "Buying guide",
    readingTime: "7 min read",
    updated: "2026-11-25",
    intro:
      "Most office software demos look similar. The differences show up in the details: whether payroll really handles Kenyan statutory rules, whether the accounting is a real ledger, and whether one company's data can ever leak into another. Use this checklist to compare options properly.",
    sections: [
      {
        heading: "1. Start with the jobs you need done",
        body: [
          "List the work that currently lives in spreadsheets, WhatsApp, email or paper. Then separate must-haves from nice-to-haves. A system that is excellent at payroll but weak at accounting may not replace the tools you are trying to remove.",
        ],
        bullets: [
          "Payroll, leave and attendance.",
          "Invoicing, bills, VAT and eTIMS.",
          "Bank and M-Pesa reconciliation.",
          "Documents, assets, visitors and tasks.",
        ],
      },
      {
        heading: "2. Check Kenyan compliance — with a live demo",
        body: [
          "Ask the vendor to show a payroll run with PAYE, NSSF, SHIF, Housing Levy and HELB. Ask where rates are configured and how updates are handled when rules change. For invoicing, ask to see an eTIMS submission and the stored control number and QR code.",
        ],
      },
      {
        heading: "3. Check the accounting depth",
        body: [
          "Expense tracking is not the same as accounting. Ask whether the system has a double-entry ledger, a chart of accounts, trial balance, profit and loss, balance sheet and VAT reporting. If it only lists income and expenses, you may still need a separate accounting tool.",
        ],
      },
      {
        heading: "4. Check permissions and data isolation",
        bullets: [
          "Can you restrict modules by role or give custom roles?",
          "Does each company have a fully isolated workspace?",
          "Is there an audit trail for sensitive changes and approvals?",
          "Does it support two-factor authentication and secure sessions?",
        ],
        body: [
          "These questions matter more as your team grows and as more company data moves into one system.",
        ],
      },
      {
        heading: "5. Check onboarding, data migration and support",
        body: [
          "Ask how existing records are imported, who verifies the totals, and what happens if rows fail. A good onboarding process includes a template, a test import, a reconciliation step and a clear support channel. Confirm the exit path too: can you export your data?",
        ],
      },
      {
        heading: "6. Compare the total cost, not just the monthly price",
        body: [
          "Look at user limits, modules included, add-ons, implementation help, training and support. A lower monthly price can be more expensive if it excludes accounting or requires a separate payroll tool.",
        ],
      },
      {
        heading: "7. Questions to ask in every demo",
        bullets: [
          "Show me a payroll run from employee records to payslip.",
          "Show me a VAT invoice and its eTIMS control number.",
          "How do you isolate one company from another?",
          "How do you import our existing Excel records?",
          "What reports can I pull without exporting to Excel?",
          "What does support look like after go-live?",
        ],
        body: [
          "A vendor who can answer these with a working screen, rather than a slide, is usually the safer choice.",
        ],
      },
    ],
    faqs: [
      {
        q: "What should I look for in Kenyan payroll software?",
        a: "Look for current PAYE, NSSF, SHIF, Housing Levy and HELB handling, configurable rates, payslips, P9 support and an approval trail. Ask to see a live payroll run, not just a feature list.",
      },
      {
        q: "Is expense tracking enough for accounting?",
        a: "No. Expense tracking records spending, but accounting needs a double-entry ledger, control accounts, reconciliation and financial statements. Check for a real ledger before replacing your accounting tool.",
      },
      {
        q: "How important is data isolation?",
        a: "It is critical. Ask how the vendor separates companies, restricts roles and audits sensitive changes. One workspace per company should be a hard requirement.",
      },
    ],
    relatedSolutions: ["payroll", "accounting", "etims", "healthcare"],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
