export interface ExcelTemplate {
  slug: string;
  name: string;
  category: string;
  description: string;
}

/**
 * The Excel starter pack is shared after a short walkthrough, not published as
 * a public download. Keep this list to names and short descriptions only.
 */
export const TEMPLATES: ExcelTemplate[] = [
  {
    slug: "payroll-register",
    name: "Payroll register",
    category: "Payroll & HR",
    description: "Basic pay, allowances, statutory deductions and net pay per employee.",
  },
  {
    slug: "leave-tracker",
    name: "Leave tracker",
    category: "Payroll & HR",
    description: "Leave requests, approvers, dates, working days and decisions.",
  },
  {
    slug: "asset-register",
    name: "Asset register",
    category: "Operations",
    description: "Asset tags, serial numbers, cost, location, custodian and condition.",
  },
  {
    slug: "invoice-vat-register",
    name: "Invoice & VAT register",
    category: "Finance",
    description: "Invoice lines, VAT treatment, totals and payment status.",
  },
  {
    slug: "patient-register",
    name: "Patient register",
    category: "Healthcare",
    description: "Patient details, visits, clinician, amount and payment status.",
  },
];
