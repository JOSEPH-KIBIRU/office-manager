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
  { key: "invoices", label: "Invoicing", group: "Finance" },
  { key: "customers", label: "Customers", group: "Finance" },
  { key: "receipts", label: "Receipts", group: "Finance" },
  { key: "bills", label: "Bills", group: "Finance" },
  { key: "suppliers", label: "Suppliers", group: "Finance" },
  { key: "payments", label: "Payments", group: "Finance" },
  { key: "chart-of-accounts", label: "Chart of accounts", group: "Finance" },
  { key: "accounting-post", label: "Post accounting transactions", group: "Finance" },
  { key: "accounting-reverse", label: "Reverse / void transactions", group: "Finance" },
  { key: "cost-centres", label: "Cost centres", group: "Management" },
  { key: "projects", label: "Projects", group: "Management" },
  { key: "budgets", label: "Budgets", group: "Management" },
  { key: "management-reports", label: "Management reports", group: "Management" },
  { key: "petty-cash", label: "Petty Cash", group: "Finance" },
  { key: "accounting", label: "Accounting", group: "Finance" },
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

/** What each built-in role can access out of the box (mirrors the sidebar). */
export const DEFAULT_ROLE_PERMISSIONS: Record<OrgRole, ModuleKey[]> = {
  admin: [...ALL_MODULE_KEYS],
  secretary: [
    "dashboard", "analytics", "org-chart", "onboarding", "leave",
    "leave-calendar", "attendance", "my-payslips", "invoices", "bills",
    "customers", "suppliers", "receipts", "payments",
    "petty-cash", "accounting", "reports", "tasks", "meetings", "minutes",
    "visitors", "assets", "organization", "documents", "profile",
    "management-reports",
  ],
  manager: [
    "dashboard", "analytics", "leave", "leave-calendar", "attendance",
    "my-payslips", "invoices", "bills", "customers", "suppliers", "petty-cash", "accounting", "cars",
    "tasks", "documents", "profile", "projects", "management-reports",
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
