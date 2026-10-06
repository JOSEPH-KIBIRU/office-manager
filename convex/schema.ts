import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema(
  {
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
    logoFileId: v.optional(v.union(v.id("_storage"), v.null())),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    taxNumber: v.optional(v.string()),
    website: v.optional(v.string()),
    // Working week: 0 = Sunday … 6 = Saturday. Used to compute actual leave
    // days (weekends and public holidays excluded). Defaults to Mon–Fri.
    workingDays: v.optional(v.array(v.number())),
    // KRA eTIMS (electronic tax invoice) settings.
    etimsEnabled: v.optional(v.boolean()),
    etimsEnv: v.optional(v.union(v.literal("sandbox"), v.literal("production"))),
    etimsBaseUrl: v.optional(v.string()),
    etimsTin: v.optional(v.string()),
    etimsBhfId: v.optional(v.string()),
    etimsDeviceSerial: v.optional(v.string()),
    etimsApiKey: v.optional(v.string()),
    etimsApiSecret: v.optional(v.string()),
    // Invoice payment reminders (dunning).
    remindersEnabled: v.optional(v.boolean()),
    reminderIntervalDays: v.optional(v.number()),
    reminderMax: v.optional(v.number()),
    // Leave policy.
    leaveEntitlement: v.optional(v.number()),
    leaveCarryOverMax: v.optional(v.number()),
    leaveEncashment: v.optional(v.boolean()),
    // Attendance / time clock.
    workStartTime: v.optional(v.string()),
    workEndTime: v.optional(v.string()),
    graceMinutes: v.optional(v.number()),
    // Fine-grained per-role module access. Keys are roles ("secretary",
    // "manager", "employee"); values are the granted module keys. "admin" is
    // always full access and is never stored here. A role with no entry keeps
    // its defaults.
    rolePermissions: v.optional(v.record(v.string(), v.array(v.string()))),
    // Company-defined extra roles beyond the built-in admin/secretary/manager/
    // employee set. Each is { key, label }; their module grants live in
    // rolePermissions keyed by `key`.
    customRoles: v.optional(v.array(v.object({ key: v.string(), label: v.string() }))),
    // Platform feature cap set by the super admin. When present, only these
    // modules are available to the company at all — they cannot be granted in
    // the company's Roles & permissions tab and are hidden from every role.
    // Absent/undefined means "all modules enabled" (the default).
    enabledModules: v.optional(v.array(v.string())),
    // Invoice defaults (entered once per company; applied to every invoice
    // unless a specific invoice overrides them).
    paymentDetails: v.optional(v.string()),
    invoiceNotes: v.optional(v.string()),
    invoiceTerms: v.optional(v.string()),
    // Soft delete: when set, the company is archived (hidden + login blocked) but
    // all of its data is retained and it can be restored.
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
    lastAccessedAt: v.optional(v.number()),
  }).index("by_slug", ["slug"]),

  users: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    passwordHash: v.string(),
    // Built-in roles: "admin" (Director), "secretary" (Admin / Secretary),
    // "manager", "employee", "super_admin". Companies may also define their own
    // roles (see organizations.customRoles), so this is a free-form string that
    // is validated against the company's role list at the API layer.
    role: v.string(),
    platformRole: v.optional(
      v.union(v.literal("superadmin"), v.literal("platform_owner"))
    ),
    employeeNumber: v.optional(v.string()),
    basicSalary: v.optional(v.number()),
    statutoryNumber: v.optional(v.string()),
    bankName: v.optional(v.string()),
    bankAccount: v.optional(v.string()),
    mpesaNumber: v.optional(v.string()),
    employmentType: v.optional(
      v.union(v.literal("permanent"), v.literal("permanent_pensionable"))
    ),
    helbDeduction: v.optional(v.number()),
    departmentId: v.optional(v.id("departments")),
    termsAgreedAt: v.optional(v.number()),
    termsVersion: v.optional(v.string()),
    leaveBalance: v.number(),
    mustChangePassword: v.boolean(),
    active: v.boolean(),
    lastLoginAt: v.optional(v.number()),
    twoFactorSecret: v.optional(v.string()),
    twoFactorEnabledAt: v.optional(v.number()),
    twoFactorRecoveryHashes: v.optional(v.array(v.string())),
    sessionVersion: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_org", ["orgId"])
    .index("by_org_department", ["orgId", "departmentId"]),

  departments: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  leaves: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
    days: v.number(),
    leaveType: v.string(),
    reason: v.string(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.string()),
    adminNote: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"])
    .index("by_org_status", ["orgId", "status"]),

  leaveCarryOvers: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    year: v.number(),
    carriedDays: v.number(),
    encashedDays: v.number(),
    paidAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_user", ["orgId", "userId"]),

  attendance: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    date: v.string(),
    clockInAt: v.number(),
    clockOutAt: v.optional(v.number()),
    note: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_user", ["orgId", "userId"])
    .index("by_org_date", ["orgId", "date"]),

  documents: defineTable({
    orgId: v.id("organizations"),
    userId: v.optional(v.id("users")),
    title: v.string(),
    category: v.union(
      v.literal("contract"),
      v.literal("license"),
      v.literal("insurance"),
      v.literal("certificate"),
      v.literal("other")
    ),
    issuedDate: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    fileName: v.optional(v.string()),
    fileId: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
    remLastAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_expiry", ["orgId", "expiryDate"]),

  checklistItems: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    kind: v.union(v.literal("onboarding"), v.literal("offboarding")),
    title: v.string(),
    done: v.boolean(),
    doneBy: v.optional(v.id("users")),
    doneAt: v.optional(v.number()),
    sortOrder: v.number(),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_user", ["orgId", "userId"]),

  carLogs: defineTable({
    orgId: v.id("organizations"),
    vehicleReg: v.string(),
    category: v.union(v.literal("repair"), v.literal("insurance"), v.literal("service")),
    description: v.string(),
    vendor: v.optional(v.string()),
    amount: v.number(),
    logDate: v.string(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    requestedBy: v.id("users"),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.string()),
    note: v.optional(v.string()),
    requisitionNo: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  pettyCash: defineTable({
    orgId: v.id("organizations"),
    requestedBy: v.id("users"),
    amount: v.number(),
    purpose: v.string(),
    dateNeeded: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("paid")
    ),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.string()),
    paidAt: v.optional(v.string()),
    note: v.optional(v.string()),
    requisitionNo: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  meetings: defineTable({
    orgId: v.id("organizations"),
    title: v.string(),
    agenda: v.optional(v.string()),
    location: v.optional(v.string()),
    scheduledAt: v.string(),
    attendeeIds: v.array(v.id("users")),
    directorId: v.optional(v.id("users")),
    status: v.union(v.literal("scheduled"), v.literal("completed"), v.literal("cancelled")),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  minutes: defineTable({
    orgId: v.id("organizations"),
    meetingId: v.optional(v.id("meetings")),
    title: v.string(),
    meetingDate: v.optional(v.string()),
    attendeesText: v.optional(v.string()),
    points: v.string(),
    content: v.string(),
    fileName: v.optional(v.string()),
    fileId: v.optional(v.id("_storage")),
    aiGenerated: v.boolean(),
    status: v.union(v.literal("draft"), v.literal("final")),
    writtenBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  profileRequests: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    field: v.union(v.literal("name"), v.literal("email")),
    currentValue: v.optional(v.string()),
    requestedValue: v.string(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  annualReset: defineTable({
    orgId: v.id("organizations"),
    year: v.number(),
    runAt: v.optional(v.number()),
  }),

  subscriptions: defineTable({
    orgId: v.id("organizations"),
    plan: v.union(
      v.literal("starter"),
      v.literal("professional"),
      v.literal("enterprise")
    ),
    billingCycle: v.union(v.literal("monthly"), v.literal("annual")),
    status: v.union(v.literal("trial"), v.literal("active"), v.literal("canceled"), v.literal("past_due")),
    trialEndsAt: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
    userCount: v.number(),
    startedAt: v.number(),
  }).index("by_org", ["orgId"]),

  rateLimitBuckets: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),

  migrations: defineTable({
    name: v.string(),
    runAt: v.number(),
  }).index("by_name", ["name"]),

  payrolls: defineTable({
    orgId: v.id("organizations"),
    month: v.number(),
    year: v.number(),
    runBy: v.id("users"),
    createdAt: v.number(),
    paidAt: v.optional(v.number()),
    paidBy: v.optional(v.id("users")),
    paymentMethod: v.optional(v.string()),
    payslips: v.array(
      v.object({
        userId: v.optional(v.id("users")),
        casualId: v.optional(v.id("casuals")),
        personType: v.optional(v.union(v.literal("employee"), v.literal("casual"))),
        name: v.string(),
        employeeNumber: v.optional(v.string()),
        role: v.string(),
        employmentType: v.optional(
          v.union(v.literal("permanent"), v.literal("permanent_pensionable"), v.literal("casual"))
        ),
        basicSalary: v.number(),
        allowances: v.number(),
        perDiem: v.optional(v.number()),
        overtimeHours: v.optional(v.number()),
        overtimeRate: v.optional(v.number()),
        overtimePay: v.optional(v.number()),
        bonus: v.optional(v.number()),
        leaveDaysPayout: v.number(),
        daysWorked: v.optional(v.number()),
        dailyRate: v.optional(v.number()),
        statutory: v.optional(v.boolean()),
        grossPay: v.number(),
        nssf: v.number(),
        nssfTier1: v.optional(v.number()),
        nssfTier2: v.optional(v.number()),
        sha: v.number(),
        housingLevy: v.number(),
        pension: v.optional(v.number()),
        taxablePay: v.optional(v.number()),
        incomeTax: v.optional(v.number()),
        personalRelief: v.optional(v.number()),
        paye: v.number(),
        helb: v.number(),
        loanRepayment: v.optional(v.number()),
        loanId: v.optional(v.id("staffLoans")),
        otherDeductions: v.optional(v.number()),
        totalDeductions: v.number(),
        netPay: v.number(),
      })
    ),
  })
    .index("by_org_month_year", ["orgId", "month", "year"])
    .index("by_org", ["orgId"]),

  staffLoans: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    kind: v.union(v.literal("loan"), v.literal("advance")),
    principal: v.number(),
    balance: v.number(),
    monthlyDeduction: v.number(),
    description: v.optional(v.string()),
    active: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_user", ["orgId", "userId"]),

  casualAttendance: defineTable({
    orgId: v.id("organizations"),
    casualId: v.id("casuals"),
    date: v.string(),
    days: v.number(),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_casual", ["orgId", "casualId"]),

  assets: defineTable({
    orgId: v.id("organizations"),
    tag: v.string(),
    name: v.string(),
    category: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    condition: v.optional(v.string()),
    status: v.union(
      v.literal("available"),
      v.literal("assigned"),
      v.literal("maintenance"),
      v.literal("retired")
    ),
    currentHolderId: v.optional(v.id("users")),
    currentHolderName: v.optional(v.string()),
    currentCheckedOutAt: v.optional(v.number()),
    active: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_tag", ["orgId", "tag"]),

  assetMovements: defineTable({
    orgId: v.id("organizations"),
    assetId: v.id("assets"),
    assetName: v.string(),
    assetTag: v.string(),
    action: v.union(v.literal("checkout"), v.literal("checkin")),
    holderId: v.id("users"),
    holderName: v.string(),
    recordedBy: v.optional(v.id("users")),
    recordedByName: v.optional(v.string()),
    at: v.number(),
    destination: v.optional(v.string()),
    condition: v.optional(v.string()),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_asset", ["orgId", "assetId"])
    .index("by_org_holder", ["orgId", "holderId"]),

  casuals: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    phone: v.optional(v.string()),
    idNumber: v.optional(v.string()),
    dailyRate: v.number(),
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  notifications: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    body: v.optional(v.string()),
    link: v.optional(v.string()),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user_unread", ["userId", "read"])
    .index("by_org", ["orgId"]),

  contacts: defineTable({
    orgId: v.id("organizations"),
    type: v.union(v.literal("customer"), v.literal("supplier")),
    // Auto-assigned reference, e.g. CUS-0001 / SUP-0001.
    number: v.optional(v.string()),
    name: v.string(),
    // Legal / business name (falls back to `name` when absent).
    legalName: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    address: v.optional(v.string()),
    tin: v.optional(v.string()),
    // Payment terms in days (e.g. 30).
    paymentTerms: v.optional(v.number()),
    creditLimit: v.optional(v.number()),
    notes: v.optional(v.string()),
    active: v.optional(v.boolean()),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_type", ["orgId", "type"]),

  invoices: defineTable({
    orgId: v.id("organizations"),
    contactId: v.id("contacts"),
    number: v.string(),
    issueDate: v.string(),
    dueDate: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("partially_paid"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("cancelled"),
      v.literal("void")
    ),
    // Amount settled by receipts/credit notes (sub-ledger). Balance = total − amountPaid.
    amountPaid: v.optional(v.number()),
    // Optional management dimensions.
    costCenterCode: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    lineItems: v.array(
      v.object({
        description: v.string(),
        qty: v.number(),
        unitPrice: v.number(),
        taxRate: v.number(),
      })
    ),
    note: v.optional(v.string()),
    paymentDetails: v.optional(v.string()),
    terms: v.optional(v.string()),
    subtotal: v.number(),
    taxTotal: v.number(),
    total: v.number(),
    recurringFrequency: v.optional(
      v.union(v.literal("weekly"), v.literal("monthly"), v.literal("quarterly"), v.literal("yearly"))
    ),
    recurringActive: v.optional(v.boolean()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    // eTIMS (KRA) submission state.
    etimsStatus: v.optional(
      v.union(v.literal("not_sent"), v.literal("pending"), v.literal("submitted"), v.literal("failed"))
    ),
    etimsControlNumber: v.optional(v.string()),
    etimsQrData: v.optional(v.string()),
    etimsSubmittedAt: v.optional(v.number()),
    etimsError: v.optional(v.string()),
    // Payment-reminder (dunning) bookkeeping.
    remLastAt: v.optional(v.number()),
    remCount: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_contact", ["orgId", "contactId"]),

  bills: defineTable({
    orgId: v.id("organizations"),
    contactId: v.id("contacts"),
    number: v.string(),
    billDate: v.string(),
    dueDate: v.string(),
    amount: v.number(),
    vatRate: v.optional(v.number()),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("received"),
      v.literal("pending"),
      v.literal("partially_paid"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("void")
    ),
    // Amount settled by payments/debit notes (sub-ledger). Balance = amount − amountPaid.
    amountPaid: v.optional(v.number()),
    // Optional management dimensions.
    costCenterCode: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    paidAt: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_contact", ["orgId", "contactId"]),

  // Receipts (money in from a customer) and payments (money out to a supplier).
  payments: defineTable({
    orgId: v.id("organizations"),
    contactId: v.id("contacts"),
    kind: v.union(v.literal("receipt"), v.literal("payment")),
    date: v.string(),
    amount: v.number(),
    method: v.union(v.literal("bank"), v.literal("mpesa"), v.literal("cash")),
    // Cash/bank/M-Pesa ledger account debited (receipt) or credited (payment).
    accountCode: v.string(),
    reference: v.optional(v.string()),
    notes: v.optional(v.string()),
    journalId: v.optional(v.id("journals")),
    createdBy: v.optional(v.id("users")),
    createdByName: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_contact", ["orgId", "contactId"]),

  // Credit notes (sales) / debit notes (purchases) — adjust what is owed.
  creditNotes: defineTable({
    orgId: v.id("organizations"),
    contactId: v.id("contacts"),
    kind: v.union(v.literal("sales_credit"), v.literal("purchase_debit")),
    number: v.string(),
    issueDate: v.string(),
    amount: v.number(),
    taxRate: v.optional(v.number()),
    subtotal: v.number(),
    taxTotal: v.number(),
    total: v.number(),
    reason: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("issued"), v.literal("void")),
    journalId: v.optional(v.id("journals")),
    createdBy: v.optional(v.id("users")),
    createdByName: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_contact", ["orgId", "contactId"]),

  // Open-item allocations: how much of a payment/credit note settles an invoice/bill.
  allocations: defineTable({
    orgId: v.id("organizations"),
    // The settled open item (exactly one is set).
    invoiceId: v.optional(v.id("invoices")),
    billId: v.optional(v.id("bills")),
    amount: v.number(),
    // The settler (exactly one is set).
    paymentId: v.optional(v.id("payments")),
    creditNoteId: v.optional(v.id("creditNotes")),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_payment", ["paymentId"])
    .index("by_credit_note", ["creditNoteId"])
    .index("by_invoice", ["invoiceId"])
    .index("by_bill", ["billId"]),

  storedFiles: defineTable({
    orgId: v.id("organizations"),
    storageId: v.id("_storage"),
    kind: v.union(v.literal("logo"), v.literal("minutes"), v.literal("task"), v.literal("other")),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_storage", ["storageId"]),

  tasks: defineTable({
    orgId: v.id("organizations"),
    title: v.string(),
    description: v.string(),
    priority: v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent")),
    dueDate: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("submitted"),
      v.literal("acknowledged"),
      v.literal("reopened"),
      v.literal("cancelled")
    ),
    createdBy: v.id("users"),
    assigneeId: v.id("users"),
    acknowledgedBy: v.optional(v.id("users")),
    acknowledgedAt: v.optional(v.string()),
    remark: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_assignee", ["orgId", "assigneeId"])
    .index("by_org_creator", ["orgId", "createdBy"]),

  taskUpdates: defineTable({
    orgId: v.id("organizations"),
    taskId: v.id("tasks"),
    userId: v.id("users"),
    kind: v.union(v.literal("report"), v.literal("comment")),
    description: v.optional(v.string()),
    doing: v.optional(v.string()),
    location: v.optional(v.string()),
    photos: v.array(v.object({ url: v.string(), name: v.string() })),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_task", ["taskId"]),

  pettyCashBudgets: defineTable({
    orgId: v.id("organizations"),
    period: v.string(),
    amount: v.number(),
    setBy: v.id("users"),
    setAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_period", ["orgId", "period"]),

  ledgerAccounts: defineTable({
    orgId: v.id("organizations"),
    code: v.string(),
    name: v.string(),
    type: v.union(
      v.literal("asset"),
      v.literal("liability"),
      v.literal("equity"),
      v.literal("income"),
      v.literal("cost_of_sales"),
      v.literal("expense")
    ),
    group: v.string(),
    // Hierarchical chart of accounts: the parent account code, if any.
    parentCode: v.optional(v.string()),
    // Balance-sheet classification (current vs non-current).
    category: v.optional(v.union(v.literal("current"), v.literal("non_current"))),
    // Control accounts are referenced by the posting engine (AR, AP, bank, tax…).
    control: v.optional(
      v.union(
        v.literal("ar"),
        v.literal("ap"),
        v.literal("bank"),
        v.literal("cash"),
        v.literal("vat_input"),
        v.literal("vat_output"),
        v.literal("retained_earnings"),
        v.literal("suspense")
      )
    ),
    // Tax treatment: "vat_16" | "vat_8" | "zero_rated" | "exempt" | "out_of_scope" | "none".
    taxTreatment: v.optional(v.string()),
    description: v.optional(v.string()),
    isCash: v.optional(v.boolean()),
    isVat: v.optional(v.boolean()),
    statutory: v.optional(v.boolean()),
    // Seeded accounts are flagged so the UI can warn before editing codes.
    builtIn: v.optional(v.boolean()),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_code", ["orgId", "code"]),

  accountingPeriods: defineTable({
    orgId: v.id("organizations"),
    period: v.string(),
    label: v.string(),
    start: v.string(),
    end: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("pending_close"),
      v.literal("closed"),
      v.literal("locked"),
      v.literal("future")
    ),
    lockedAt: v.optional(v.string()),
    lockedBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_period", ["orgId", "period"]),

  journals: defineTable({
    orgId: v.id("organizations"),
    date: v.string(),
    period: v.string(),
    ref: v.string(),
    source: v.union(
      v.literal("opening"),
      v.literal("invoice"),
      v.literal("bill"),
      v.literal("receipt"),
      v.literal("payment"),
      v.literal("credit_note"),
      v.literal("asset"),
      v.literal("recurring"),
      v.literal("payroll"),
      v.literal("petty_cash"),
      v.literal("petty_cash_fund"),
      v.literal("car_log"),
      v.literal("bank"),
      v.literal("vat"),
      v.literal("depreciation"),
      v.literal("manual")
    ),
    sourceId: v.optional(v.string()),
    description: v.string(),
    lines: v.array(
      v.object({
        accountCode: v.string(),
        debit: v.number(),
        credit: v.number(),
        memo: v.optional(v.string()),
        // Management dimensions (optional) carried on the posting line.
        costCenterCode: v.optional(v.string()),
        projectId: v.optional(v.id("projects")),
      })
    ),
    postedBy: v.optional(v.id("users")),
    postedByName: v.optional(v.string()),
    postedAt: v.number(),
    reversedBy: v.optional(v.id("journals")),
    reversesId: v.optional(v.id("journals")),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_period", ["orgId", "period"])
    .index("by_source", ["orgId", "source", "sourceId"]),

  bankLines: defineTable({
    orgId: v.id("organizations"),
    // Linked ledger account (the cash/bank account this movement belongs to).
    accountCode: v.string(),
    // Optional link to the bank/M-Pesa account entity.
    bankAccountId: v.optional(v.id("bankAccounts")),
    date: v.string(),
    description: v.string(),
    // Signed: positive = money in, negative = money out.
    amount: v.number(),
    reference: v.optional(v.string()),
    // unmatched | partially_matched | matched | ignored | reconciled
    status: v.union(
      v.literal("unmatched"),
      v.literal("partially_matched"),
      v.literal("matched"),
      v.literal("ignored"),
      v.literal("reconciled")
    ),
    // How the line entered the system: import | manual | transfer | receipt | payment
    source: v.optional(v.string()),
    // Original 1:1 journal link (legacy + quick matches).
    journalId: v.optional(v.id("journals")),
    ruleId: v.optional(v.id("bankRules")),
    notes: v.optional(v.string()),
    importRef: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_account", ["orgId", "accountCode"])
    .index("by_org_status", ["orgId", "status"])
    .index("by_org_account_date", ["orgId", "accountCode", "date"]),

  // Bank and M-Pesa accounts (M-Pesa is modelled as a cash/bank account).
  bankAccounts: defineTable({
    orgId: v.id("organizations"),
    kind: v.union(v.literal("bank"), v.literal("mpesa")),
    name: v.string(),
    bankName: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    currency: v.string(),
    openingBalance: v.number(),
    // The ledger account (asset, isCash) this bank account posts to.
    accountCode: v.string(),
    // M-Pesa specifics.
    paybill: v.optional(v.string()),
    till: v.optional(v.string()),
    businessNumber: v.optional(v.string()),
    active: v.boolean(),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_active", ["orgId", "active"]),

  // Allocations linking a bank statement line to book entries (1:1 and 1:many).
  bankLineMatches: defineTable({
    orgId: v.id("organizations"),
    bankLineId: v.id("bankLines"),
    amount: v.number(),
    journalId: v.optional(v.id("journals")),
    // Optional link to the sub-ledger document that created the journal.
    paymentId: v.optional(v.id("payments")),
    creditNoteId: v.optional(v.id("creditNotes")),
    note: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    createdByName: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_line", ["bankLineId"]),

  // Money moved between two of the company's own accounts.
  bankTransfers: defineTable({
    orgId: v.id("organizations"),
    date: v.string(),
    fromAccountCode: v.string(),
    toAccountCode: v.string(),
    amount: v.number(),
    reference: v.optional(v.string()),
    notes: v.optional(v.string()),
    journalId: v.optional(v.id("journals")),
    createdBy: v.optional(v.id("users")),
    createdByName: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"]),

  // Rules that suggest (or, if enabled, auto-post) a classification.
  bankRules: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    matchField: v.union(v.literal("description"), v.literal("reference")),
    matchType: v.union(v.literal("contains"), v.literal("equals"), v.literal("starts_with")),
    matchValue: v.string(),
    suggestAccountCode: v.string(),
    // Suggest a receipt/payment/expense/transfer classification.
    suggestType: v.optional(v.string()),
    autoPost: v.boolean(),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_org", ["orgId"]),

  // Reconciliation statements (auditable; never deleted).
  reconciliations: defineTable({
    orgId: v.id("organizations"),
    accountCode: v.string(),
    bankAccountId: v.optional(v.id("bankAccounts")),
    periodStart: v.optional(v.string()),
    periodEnd: v.string(),
    statementClosingBalance: v.number(),
    bookBalance: v.number(),
    outstandingDeposits: v.number(),
    outstandingPayments: v.number(),
    adjustedBalance: v.number(),
    difference: v.number(),
    status: v.union(v.literal("in_progress"), v.literal("completed")),
    adjustmentJournalId: v.optional(v.id("journals")),
    completedBy: v.optional(v.id("users")),
    completedByName: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_org", ["orgId"]),

  // Accounting fixed-asset register (distinct from the operational `assets` register).
  fixedAssets: defineTable({
    orgId: v.id("organizations"),
    tag: v.string(),
    name: v.string(),
    category: v.optional(v.string()),
    purchaseDate: v.string(),
    purchaseCost: v.number(),
    supplierId: v.optional(v.id("contacts")),
    location: v.optional(v.string()),
    custodian: v.optional(v.string()),
    usefulLifeYears: v.number(),
    depreciationMethod: v.union(v.literal("straight_line")),
    residualValue: v.number(),
    accumulatedDepreciation: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("purchased"),
      v.literal("active"),
      v.literal("disposed"),
      v.literal("archived")
    ),
    assetAccountCode: v.string(),
    accumDepAccountCode: v.string(),
    depExpenseAccountCode: v.string(),
    purchaseJournalId: v.optional(v.id("journals")),
    disposedDate: v.optional(v.string()),
    disposalProceeds: v.optional(v.number()),
    disposalJournalId: v.optional(v.id("journals")),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_tag", ["orgId", "tag"]),

  // Recurring bills / expenses / journals.
  recurringTransactions: defineTable({
    orgId: v.id("organizations"),
    kind: v.union(v.literal("bill"), v.literal("expense"), v.literal("journal")),
    name: v.string(),
    description: v.optional(v.string()),
    frequency: v.union(v.literal("weekly"), v.literal("monthly"), v.literal("quarterly"), v.literal("yearly")),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    nextRun: v.string(),
    amount: v.number(),
    accountCode: v.optional(v.string()),
    vatRate: v.optional(v.number()),
    taxTreatment: v.optional(v.string()),
    supplierId: v.optional(v.id("contacts")),
    lines: v.optional(
      v.array(v.object({ accountCode: v.string(), debit: v.number(), credit: v.number(), memo: v.optional(v.string()) }))
    ),
    active: v.boolean(),
    lastRunAt: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_org", ["orgId"]),

  // Month-end close checklist items.
  closeTasks: defineTable({
    orgId: v.id("organizations"),
    period: v.string(),
    key: v.string(),
    label: v.string(),
    status: v.union(v.literal("pending"), v.literal("in_progress"), v.literal("complete"), v.literal("blocked")),
    note: v.optional(v.string()),
    updatedBy: v.optional(v.id("users")),
    updatedByName: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_period", ["orgId", "period"]),

  // Management accounting dimensions.
  costCentres: defineTable({
    orgId: v.id("organizations"),
    code: v.string(),
    name: v.string(),
    type: v.union(
      v.literal("branch"),
      v.literal("department"),
      v.literal("location"),
      v.literal("cost_centre")
    ),
    active: v.boolean(),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_code", ["orgId", "code"]),

  projects: defineTable({
    orgId: v.id("organizations"),
    code: v.string(),
    name: v.string(),
    customerId: v.optional(v.id("contacts")),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    budget: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("on_hold"),
      v.literal("completed")
    ),
    active: v.boolean(),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_code", ["orgId", "code"]),

  budgets: defineTable({
    orgId: v.id("organizations"),
    // "YYYY" (annual) or "YYYY-MM" (monthly).
    period: v.string(),
    frequency: v.union(v.literal("annual"), v.literal("monthly")),
    accountCode: v.string(),
    costCenterCode: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    amount: v.number(),
    note: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_period", ["orgId", "period"]),

  dimensionRequirements: defineTable({
    orgId: v.id("organizations"),
    accountCode: v.string(),
    requireCostCentre: v.boolean(),
    requireProject: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_account", ["orgId", "accountCode"]),


  calendarConnections: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    provider: v.union(v.literal("google"), v.literal("microsoft")),
    email: v.optional(v.string()),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("error")),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"])
    .index("by_user_provider", ["userId", "provider"]),

  calendarEvents: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    provider: v.string(),
    sourceType: v.string(),
    sourceId: v.string(),
    externalEventId: v.string(),
    calendarId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_source", ["sourceType", "sourceId"])
    .index("by_user", ["userId"]),

  calendarSyncJobs: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    provider: v.string(),
    sourceType: v.string(),
    sourceId: v.string(),
    action: v.union(v.literal("upsert"), v.literal("delete")),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("error")
    ),
    attempts: v.number(),
    lastError: v.optional(v.string()),
    runAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status_runAt", ["status", "runAt"])
    .index("by_source", ["sourceType", "sourceId"]),

  announcements: defineTable({
    message: v.string(),
    type: v.union(
      v.literal("info"),
      v.literal("maintenance"),
      v.literal("training"),
      v.literal("offer"),
      v.literal("outage")
    ),
    link: v.optional(v.string()),
    active: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    color: v.optional(v.string()),
  }).index("by_active", ["active"]),

  enquiries: defineTable({
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    company: v.optional(v.string()),
    subject: v.optional(v.string()),
    message: v.string(),
    status: v.union(v.literal("new"), v.literal("contacted"), v.literal("closed")),
    createdAt: v.number(),
  }).index("by_status", ["status"]),

  visitors: defineTable({
    orgId: v.id("organizations"),
    visitorName: v.string(),
    phone: v.string(),
    carReg: v.optional(v.string()),
    visitorTo: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("seen"), v.literal("completed")),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  holidays: defineTable({
    orgId: v.id("organizations"),
    date: v.string(),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  backups: defineTable({
    orgId: v.id("organizations"),
    orgName: v.string(),
    kind: v.union(v.literal("manual"), v.literal("pre_delete"), v.literal("pre_restore")),
    storageId: v.id("_storage"),
    size: v.number(),
    counts: v.any(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  passwordResets: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    codeHash: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
    usedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"]),

  auditLogs: defineTable({
    orgId: v.id("organizations"),
    actorId: v.optional(v.id("users")),
    actorName: v.string(),
    actorRole: v.string(),
    action: v.string(),
    module: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    summary: v.string(),
    metadata: v.optional(v.any()),
    ip: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_module", ["orgId", "module"])
    .index("by_org_action", ["orgId", "action"]),

  healthChecks: defineTable({
    status: v.union(v.literal("up"), v.literal("down")),
    source: v.optional(v.string()),
    latencyMs: v.optional(v.number()),
    error: v.optional(v.string()),
    checkedAt: v.number(),
  }).index("by_checkedAt", ["checkedAt"]),
});
