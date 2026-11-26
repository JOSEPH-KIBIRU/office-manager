export interface FreeTemplate {
  slug: string;
  name: string;
  file: string;
  category: string;
  description: string;
  bestFor: string;
  includes: string[];
  relatedSolution: { label: string; href: string };
}

export const TEMPLATES: FreeTemplate[] = [
  {
    slug: "payroll-register",
    name: "Payroll register",
    file: "/templates/payroll-register-template.xlsx",
    category: "Payroll & HR",
    description:
      "Track basic pay, allowances, statutory deductions and net pay for every employee in one clean register.",
    bestFor: "Small teams moving payroll off scattered spreadsheets.",
    includes: [
      "Employee number, name and KRA PIN",
      "NSSF and SHIF numbers",
      "Basic salary, allowances and overtime",
      "PAYE, NSSF, SHIF, Housing Levy and HELB columns",
      "Net pay and notes",
      "A separate instructions sheet",
    ],
    relatedSolution: { label: "Payroll module", href: "/solutions/payroll" },
  },
  {
    slug: "leave-tracker",
    name: "Leave tracker",
    file: "/templates/leave-tracker-template.xlsx",
    category: "Payroll & HR",
    description:
      "Record leave requests, approvers and decisions so balances and history stop living in WhatsApp threads.",
    bestFor: "Offices with no formal leave request process yet.",
    includes: [
      "Employee number and name",
      "Leave type and reason",
      "Start date, end date and working days",
      "Approver and status",
      "Notes column for handover details",
      "A separate instructions sheet",
    ],
    relatedSolution: { label: "Leave management", href: "/solutions/leave" },
  },
  {
    slug: "asset-register",
    name: "Asset register",
    file: "/templates/asset-register-template.xlsx",
    category: "Operations",
    description:
      "Keep a tagged list of laptops, furniture, vehicles and equipment with custodian and condition.",
    bestFor: "Any office that needs an audit-ready fixed asset list.",
    includes: [
      "Unique asset tag and description",
      "Category, serial number and supplier",
      "Purchase date and cost",
      "Location and custodian",
      "Condition and status",
      "A separate instructions sheet",
    ],
    relatedSolution: { label: "Asset management", href: "/solutions/assets" },
  },
  {
    slug: "invoice-vat-register",
    name: "Invoice & VAT register",
    file: "/templates/invoice-vat-template.xlsx",
    category: "Finance",
    description:
      "Capture invoice lines, VAT and payment status in a format that is easy to review and reconcile.",
    bestFor: "Businesses issuing invoices and tracking VAT manually.",
    includes: [
      "Invoice number and dates",
      "Customer and KRA PIN",
      "Description, quantity and unit price",
      "VAT rate and VAT amount",
      "Total and payment status",
      "A separate instructions sheet",
    ],
    relatedSolution: { label: "Invoicing & eTIMS", href: "/solutions/etims" },
  },
  {
    slug: "patient-register",
    name: "Patient register",
    file: "/templates/patient-register-template.xlsx",
    category: "Healthcare",
    description:
      "A clinic-ready register for patients and visits, laid out to match the Office Manager Excel importer.",
    bestFor: "Clinics and hospitals digitising paper or spreadsheet records.",
    includes: [
      "Patient number, name and contact details",
      "Gender, date of birth and age",
      "Patient notes",
      "Visit date, procedure and doctor",
      "Amount, payment method and payment status",
      "A separate instructions sheet",
    ],
    relatedSolution: { label: "Healthcare module", href: "/solutions/healthcare" },
  },
];

export function getTemplate(slug: string) {
  return TEMPLATES.find((template) => template.slug === slug);
}
