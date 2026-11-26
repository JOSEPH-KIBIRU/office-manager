/**
 * Generates the Excel starter pack that is sent to prospects after a short
 * walkthrough. Output goes to internal/templates, which is gitignored and is
 * never served by the website.
 * Run with: node scripts/generate-templates.mjs
 */
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), "internal", "templates");
fs.mkdirSync(outDir, { recursive: true });

const templates = [
  {
    file: "payroll-register-template.xlsx",
    sheet: "Payroll register",
    columns: [
      ["Employee No.", "employeeNo", 14],
      ["Employee Name", "employeeName", 28],
      ["KRA PIN", "kraPin", 18],
      ["NSSF No.", "nssf", 16],
      ["SHIF No.", "shif", 16],
      ["Employment Type", "employmentType", 18],
      ["Basic Salary", "basicSalary", 15],
      ["Allowances", "allowances", 14],
      ["Overtime", "overtime", 12],
      ["Gross Pay", "grossPay", 14],
      ["PAYE", "paye", 12],
      ["NSSF", "nssfDeduction", 12],
      ["SHIF", "shifDeduction", 12],
      ["Housing Levy", "housingLevy", 14],
      ["HELB", "helb", 10],
      ["Other Deductions", "otherDeductions", 16],
      ["Net Pay", "netPay", 14],
      ["Notes", "notes", 30],
    ],
    sample: {
      employeeNo: "EMP-001",
      employeeName: "Jane Wanjiku",
      kraPin: "A123456789Z",
      nssf: "NSSF-001",
      shif: "SHIF-001",
      employmentType: "Permanent",
      basicSalary: 75000,
      allowances: 5000,
      overtime: 0,
      grossPay: 80000,
      paye: 0,
      nssfDeduction: 0,
      shifDeduction: 0,
      housingLevy: 0,
      helb: 0,
      otherDeductions: 0,
      netPay: 0,
      notes: "Replace the sample row with your employee data.",
    },
    instructions: [
      "PAYROLL REGISTER TEMPLATE",
      "",
      "One row per employee per payroll period.",
      "Use current KRA, NSSF, SHIF, Housing Levy and HELB rules. Rates and thresholds change, so confirm them before each run.",
      "Gross Pay is usually Basic Salary + Allowances + Overtime.",
      "Net Pay is Gross Pay minus statutory and other deductions.",
      "Keep employee numbers unique and consistent with your HR records.",
      "Do not include totals rows in the data area.",
      "This template is a starting point, not a tax calculation engine.",
    ],
  },
  {
    file: "leave-tracker-template.xlsx",
    sheet: "Leave tracker",
    columns: [
      ["Employee No.", "employeeNo", 14],
      ["Employee Name", "employeeName", 28],
      ["Leave Type", "leaveType", 16],
      ["Start Date", "startDate", 14],
      ["End Date", "endDate", 14],
      ["Days", "days", 10],
      ["Reason", "reason", 30],
      ["Approver", "approver", 22],
      ["Status", "status", 12],
      ["Notes", "notes", 30],
    ],
    sample: {
      employeeNo: "EMP-001",
      employeeName: "Jane Wanjiku",
      leaveType: "Annual",
      startDate: "2026-12-01",
      endDate: "2026-12-05",
      days: 5,
      reason: "Family holiday",
      approver: "Director",
      status: "Approved",
      notes: "Replace with your own records.",
    },
    instructions: [
      "LEAVE TRACKER TEMPLATE",
      "",
      "One row per leave request.",
      "Leave Type examples: Annual, Sick, Maternity, Paternity, Bereavement, Compassionate, Unpaid.",
      "Use YYYY-MM-DD for dates.",
      "Days should count working days according to your policy; weekends and public holidays may be excluded.",
      "Status examples: Pending, Approved, Rejected, Cancelled.",
      "Keep a record of the approver and the decision.",
    ],
  },
  {
    file: "asset-register-template.xlsx",
    sheet: "Asset register",
    columns: [
      ["Asset Tag", "tag", 14],
      ["Asset Name", "name", 26],
      ["Category", "category", 16],
      ["Serial Number", "serial", 20],
      ["Purchase Date", "purchaseDate", 14],
      ["Purchase Cost", "cost", 14],
      ["Supplier", "supplier", 22],
      ["Location", "location", 20],
      ["Custodian", "custodian", 22],
      ["Condition", "condition", 14],
      ["Status", "status", 14],
      ["Notes", "notes", 30],
    ],
    sample: {
      tag: "AST-001",
      name: "Dell Latitude 5440",
      category: "Laptop",
      serial: "SN-123456",
      purchaseDate: "2026-01-15",
      cost: 120000,
      supplier: "Example supplier",
      location: "Nairobi office",
      custodian: "Jane Wanjiku",
      condition: "Good",
      status: "In use",
      notes: "Replace with your own asset data.",
    },
    instructions: [
      "ASSET REGISTER TEMPLATE",
      "",
      "One row per asset.",
      "Use a unique asset tag for every item.",
      "Record serial numbers, purchase dates and costs for audits and insurance.",
      "Update the custodian and location whenever an item moves.",
      "Condition examples: New, Good, Fair, Poor, Damaged.",
      "Status examples: In use, In store, Under repair, Disposed.",
    ],
  },
  {
    file: "invoice-vat-template.xlsx",
    sheet: "Invoice register",
    columns: [
      ["Invoice No.", "invoiceNo", 14],
      ["Invoice Date", "invoiceDate", 14],
      ["Due Date", "dueDate", 14],
      ["Customer", "customer", 28],
      ["Customer KRA PIN", "customerPin", 18],
      ["Description", "description", 32],
      ["Quantity", "quantity", 10],
      ["Unit Price", "unitPrice", 14],
      ["VAT Rate", "vatRate", 12],
      ["VAT Amount", "vatAmount", 14],
      ["Total", "total", 14],
      ["Payment Status", "status", 16],
      ["Notes", "notes", 30],
    ],
    sample: {
      invoiceNo: "INV-0001",
      invoiceDate: "2026-12-01",
      dueDate: "2026-12-31",
      customer: "Example Customer Ltd",
      customerPin: "P051234567X",
      description: "Professional services",
      quantity: 1,
      unitPrice: 50000,
      vatRate: "16%",
      vatAmount: 8000,
      total: 58000,
      status: "Unpaid",
      notes: "Check the current KRA eTIMS requirements.",
    },
    instructions: [
      "INVOICE & VAT TEMPLATE",
      "",
      "One row per invoice line, or one row per invoice if you only need a summary.",
      "Use YYYY-MM-DD for dates.",
      "VAT Rate examples: 16%, 8%, 0%, Exempt.",
      "Confirm the VAT treatment with your accountant or KRA.",
      "Payment Status examples: Draft, Sent, Paid, Overdue, Cancelled.",
      "For eTIMS, submit the invoice through a compliant system and store the control number and QR code.",
    ],
  },
  {
    file: "patient-register-template.xlsx",
    sheet: "Patients and visits",
    columns: [
      ["Patient No.", "patientNo", 14],
      ["Full Name", "fullName", 28],
      ["Phone", "phone", 16],
      ["Email", "email", 26],
      ["Gender", "gender", 10],
      ["Date of Birth", "dob", 14],
      ["Age", "age", 8],
      ["Address", "address", 24],
      ["Patient Notes", "patientNotes", 30],
      ["Visit Date", "visitDate", 14],
      ["Procedure / Service", "procedure", 28],
      ["Doctor", "doctor", 20],
      ["Amount", "amount", 12],
      ["Payment Method", "paymentMethod", 18],
      ["Payment Status", "paymentStatus", 16],
    ],
    sample: {
      patientNo: "P-0001",
      fullName: "Jane Wanjiku",
      phone: "0712345678",
      email: "jane@example.com",
      gender: "Female",
      dob: "1990-05-14",
      age: 36,
      address: "Nairobi",
      patientNotes: "No known allergies",
      visitDate: "2026-12-01",
      procedure: "General Consultation",
      doctor: "Dr. Otieno",
      amount: 1500,
      paymentMethod: "Cash",
      paymentStatus: "Paid",
    },
    instructions: [
      "PATIENT REGISTER TEMPLATE",
      "",
      "One row per visit. Patient details can be repeated on every row.",
      "Use Patient No. to match existing patients, or leave it blank for new patients.",
      "Gender: Male or Female.",
      "Dates: YYYY-MM-DD or DD/MM/YYYY.",
      "Payment Method: Cash, M-Pesa, Card, Bank Transfer, Insurance, Other.",
      "Payment Status: Paid or Unpaid.",
      "Office Manager can import this layout from Excel or CSV; duplicates are matched by patient number, phone or name.",
    ],
  },
];

function styleHeader(row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  row.alignment = { vertical: "middle" };
  row.height = 22;
}

for (const template of templates) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Office Manager";
  wb.created = new Date();

  const sheet = wb.addWorksheet(template.sheet, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = template.columns.map(([header, key, width]) => ({ header, key, width }));
  styleHeader(sheet.getRow(1));
  sheet.addRow(template.sample);

  const instructions = wb.addWorksheet("Instructions", { views: [{ showGridLines: false }] });
  instructions.columns = [{ width: 110 }];
  template.instructions.forEach((line, index) => {
    const row = instructions.addRow([line]);
    if (index === 0) row.font = { bold: true, size: 14 };
  });

  const out = path.join(outDir, template.file);
  await wb.xlsx.writeFile(out);
  console.log("wrote", out);
}
