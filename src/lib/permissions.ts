/**
 * Fine-grained, per-role module access.
 *
 * The platform ships four organisation roles (admin, secretary, manager,
 * employee). By default each role sees exactly the modules the sidebar has
 * always shown. An admin can then toggle any module on or off per role; the
 * "admin" role always keeps full access and cannot be restricted.
 *
 * This module is client-safe (no server-only imports) so it can be shared by
 * the sidebar, the permissions configuration page and the server guard.
 */

export type OrgRole = "admin" | "secretary" | "manager" | "employee";

export type ModuleKey =
  | "dashboard"
  | "analytics"
  | "team"
  | "departments"
  | "org-chart"
  | "onboarding"
  | "leave"
  | "leave-calendar"
  | "attendance"
  | "payroll"
  | "my-payslips"
  | "invoices"
  | "bills"
  | "customers"
  | "suppliers"
  | "receipts"
  | "payments"
  | "chart-of-accounts"
  | "accounting-post"
  | "accounting-reverse"
  | "cost-centres"
  | "projects"
  | "budgets"
  | "management-reports"
  | "leave-approve"
  | "petty-cash-approve"
  | "car-approve"
  | "visitor-manage"
  | "task-manage"
  | "user-manage"
  | "organization-settings"
  | "payroll-run"
  | "attendance-manage"
  | "petty-cash"
  | "accounting"
  | "cars"
  | "reports"
  | "tasks"
  | "meetings"
  | "minutes"
  | "visitors"
  | "assets"
  | "organization"
  | "audit-log"
  | "documents"
  | "profile";

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  group: string;
  /** Controlled only from the platform console (not grantable by company admins). */
  platformOnly?: boolean;
}

export const MODULES: ModuleDef[] = [
  { key: "dashboard", label: "Dashboard", group: "Overview" },
  { key: "analytics", label: "Analytics", group: "Overview" },
  { key: "team", label: "Team", group: "People & HR" },
  { key: "departments", label: "Departments", group: "People & HR" },
  { key: "org-chart", label: "Org chart", group: "People & HR" },
  { key: "onboarding", label: "Onboarding", group: "People & HR" },
  { key: "leave", label: "Leave", group: "People & HR" },
  { key: "leave-calendar", label: "Leave calendar", group: "People & HR" },
  { key: "attendance", label: "Attendance", group: "People & HR" },
  { key: "payroll", label: "Payroll", group: "People & HR" },
  { key: "my-payslips", label: "My Payslips", group: "People & HR" },
  // Accounting — one centralized group so the whole firm-level suite can be
  // granted/enabled together (see ACCOUNTING_MODULE_KEYS) or item by item.
  { key: "accounting", label: "Accounting", group: "Accounting" },
  { key: "chart-of-accounts", label: "Chart of accounts", group: "Accounting" },
  { key: "accounting-post", label: "Post accounting transactions", group: "Accounting" },
  { key: "accounting-reverse", label: "Reverse / void transactions", group: "Accounting" },
  { key: "invoices", label: "Invoicing", group: "Accounting" },
  { key: "customers", label: "Customers", group: "Accounting" },
  { key: "receipts", label: "Receipts", group: "Accounting" },
  { key: "bills", label: "Bills", group: "Accounting" },
  { key: "suppliers", label: "Suppliers", group: "Accounting" },
  { key: "payments", label: "Payments", group: "Accounting" },
  { key: "cost-centres", label: "Cost centres", group: "Accounting" },
  { key: "projects", label: "Projects", group: "Accounting" },
  { key: "budgets", label: "Budgets", group: "Accounting" },
  { key: "management-reports", label: "Management reports", group: "Accounting" },
  { key: "leave-approve", label: "Approve leave", group: "Controls" },
  { key: "petty-cash-approve", label: "Approve petty cash", group: "Controls" },
  { key: "car-approve", label: "Approve car logs", group: "Controls" },
  { key: "visitor-manage", label: "Manage visitors", group: "Controls" },
  { key: "task-manage", label: "Manage tasks", group: "Controls" },
  { key: "user-manage", label: "Manage team", group: "Controls" },
  { key: "organization-settings", label: "Company settings", group: "Controls" },
  { key: "payroll-run", label: "Run & pay payroll", group: "Controls" },
  { key: "attendance-manage", label: "Manage attendance", group: "Controls" },
  // Kept separate from the Accounting bundle (operational expenses).
  { key: "petty-cash", label: "Petty Cash", group: "Finance" },
  { key: "cars", label: "Car Logs", group: "Finance" },
  { key: "reports", label: "Reports", group: "Reporting" },
  { key: "tasks", label: "Tasks", group: "Operations" },
  { key: "meetings", label: "Meetings", group: "Operations" },
  { key: "minutes", label: "Minutes", group: "Operations" },
  { key: "visitors", label: "Visitors", group: "Operations" },
  { key: "assets", label: "Assets", group: "Operations" },
  { key: "organization", label: "Branding & Company", group: "Company" },
  { key: "audit-log", label: "Audit log", group: "Company", platformOnly: true },
  { key: "documents", label: "Documents", group: "Company" },
  { key: "profile", label: "My Profile", group: "Company" },
];

export const ALL_MODULE_KEYS: ModuleKey[] = MODULES.map((m) => m.key);

/** Display order of module groups (shared by the permissions, features and modules pages). */
export const GROUP_ORDER = [
  "Overview",
  "People & HR",
  "Accounting",
  "Controls",
  "Finance",
  "Reporting",
  "Operations",
  "Company",
];

/**
 * The core accounting suite. Enabling/granting these keys together gives a firm
 * a complete accounting module without the rest of the app. Petty cash, car logs
 * and the generic Reports hub are deliberately excluded.
 */
export const ACCOUNTING_MODULE_KEYS: ModuleKey[] = [
  "accounting",
  "chart-of-accounts",
  "accounting-post",
  "accounting-reverse",
  "invoices",
  "customers",
  "receipts",
  "bills",
  "suppliers",
  "payments",
  "cost-centres",
  "projects",
  "budgets",
  "management-reports",
];

/** What each built-in role can access out of the box (mirrors the sidebar). */
export const DEFAULT_ROLE_PERMISSIONS: Record<OrgRole, ModuleKey[]> = {
  admin: [...ALL_MODULE_KEYS],
  secretary: [
    "dashboard", "analytics", "org-chart", "onboarding", "leave",
    "leave-calendar", "attendance", "my-payslips", "invoices", "bills",
    "customers", "suppliers", "receipts", "payments",
    "petty-cash", "accounting", "reports", "tasks", "meetings", "minutes",
    "visitors", "assets", "organization", "documents", "profile",
    "management-reports", "attendance-manage",
  ],
  manager: [
    "dashboard", "analytics", "leave", "leave-calendar", "attendance",
    "my-payslips", "invoices", "bills", "customers", "suppliers", "petty-cash", "accounting", "cars",
    "tasks", "documents", "profile", "projects", "management-reports", "attendance-manage",
  ],
  employee: [
    "dashboard", "analytics", "leave", "leave-calendar", "attendance",
    "my-payslips", "petty-cash", "tasks", "documents", "profile",
  ],
};

export const ORG_ROLES: OrgRole[] = ["admin", "secretary", "manager", "employee"];

/** Company roles that are not built-in (i.e. defined in organizations.customRoles). */
export function isBuiltinOrgRole(role: string): role is OrgRole {
  return (ORG_ROLES as string[]).includes(role);
}

export const ROLE_LABELS: Record<OrgRole, string> = {
  admin: "Director",
  secretary: "Admin / Secretary",
  manager: "Manager",
  employee: "Employee",
};

/**
 * Resolve the effective grant list for a role given the stored org overrides.
 * `admin` always receives everything; a role with no stored override falls back
 * to its defaults so behaviour is unchanged until an admin configures it.
 */
export function resolveRolePermissions(
  role: OrgRole,
  overrides: Record<string, string[]> | undefined
): ModuleKey[] {
  if (role === "admin") return [...ALL_MODULE_KEYS];
  const configured = overrides?.[role];
  if (Array.isArray(configured)) return ALL_MODULE_KEYS.filter((k) => configured.includes(k));
  // Custom roles with no stored grants get nothing by default.
  const defaults = DEFAULT_ROLE_PERMISSIONS[role];
  return defaults ? [...defaults] : [];
}

export function hasPermission(granted: string[] | undefined, module: string): boolean {
  return !!granted?.includes(module);
}

export function groupModules(modules: ModuleKey[]): Map<string, ModuleDef[]> {
  const map = new Map<string, ModuleDef[]>();
  for (const def of MODULES) {
    if (!modules.includes(def.key)) continue;
    const list = map.get(def.group) ?? [];
    list.push(def);
    map.set(def.group, list);
  }
  return map;
}
