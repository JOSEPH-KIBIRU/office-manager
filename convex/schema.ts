import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema(
  {
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_slug", ["slug"]),

  users: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    passwordHash: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("secretary"),
      v.literal("manager"),
      v.literal("employee"),
      v.literal("super_admin")
    ),
    platformRole: v.optional(
      v.union(v.literal("superadmin"), v.literal("platform_owner"))
    ),
    employeeNumber: v.optional(v.string()),
    basicSalary: v.optional(v.number()),
    statutoryNumber: v.optional(v.string()),
    helbDeduction: v.optional(v.number()),
    leaveBalance: v.number(),
    mustChangePassword: v.boolean(),
    active: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_org", ["orgId"]),

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
    .index("by_org_status", ["orgId", "status"]),

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

  payrolls: defineTable({
    orgId: v.id("organizations"),
    month: v.number(),
    year: v.number(),
    runBy: v.id("users"),
    createdAt: v.number(),
    payslips: v.array(
      v.object({
        userId: v.id("users"),
        name: v.string(),
        employeeNumber: v.optional(v.string()),
        role: v.string(),
        basicSalary: v.number(),
        allowances: v.number(),
        leaveDaysPayout: v.number(),
        grossPay: v.number(),
        nssf: v.number(),
        sha: v.number(),
        housingLevy: v.number(),
        taxablePay: v.optional(v.number()),
        incomeTax: v.optional(v.number()),
        personalRelief: v.optional(v.number()),
        paye: v.number(),
        helb: v.number(),
        totalDeductions: v.number(),
        netPay: v.number(),
      })
    ),
  })
    .index("by_org_month_year", ["orgId", "month", "year"])
    .index("by_org", ["orgId"]),

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
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    address: v.optional(v.string()),
    tin: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  invoices: defineTable({
    orgId: v.id("organizations"),
    contactId: v.id("contacts"),
    number: v.string(),
    issueDate: v.string(),
    dueDate: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("cancelled")
    ),
    lineItems: v.array(
      v.object({
        description: v.string(),
        qty: v.number(),
        unitPrice: v.number(),
        taxRate: v.number(),
      })
    ),
    note: v.optional(v.string()),
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
  }).index("by_org", ["orgId"]),

  bills: defineTable({
    orgId: v.id("organizations"),
    contactId: v.id("contacts"),
    number: v.string(),
    billDate: v.string(),
    dueDate: v.string(),
    amount: v.number(),
    description: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("overdue")),
    paidAt: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_org", ["orgId"]),
});
