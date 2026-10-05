"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Role, SessionPayload } from "@/lib/types";
import NotificationBell from "@/components/NotificationBell";
import UserMenu from "@/components/UserMenu";
import CookieSettingsButton from "@/components/CookieSettingsButton";
import { api } from "@/components/ui";
import { type ApiOrg } from "@/components/OrgBranding";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: Role[];
  module: string;
  /** Admin-control pages (e.g. roles & permissions) never masked by the platform cap. */
  always?: boolean;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "🏠", roles: ["admin", "secretary", "manager", "employee"], module: "dashboard" },
      { href: "/analytics", label: "Analytics", icon: "📊", roles: ["admin", "secretary", "manager", "employee"], module: "analytics" },
    ],
  },
  {
    title: "People & HR",
    items: [
      { href: "/users", label: "Team", icon: "👥", roles: ["admin"], module: "team" },
      { href: "/departments", label: "Departments", icon: "🏢", roles: ["admin"], module: "departments" },
      { href: "/org-chart", label: "Org chart", icon: "🧭", roles: ["admin", "secretary"], module: "org-chart" },
      { href: "/checklists", label: "Onboarding", icon: "🧩", roles: ["admin", "secretary"], module: "onboarding" },
      { href: "/leave", label: "Leave", icon: "🌴", roles: ["admin", "secretary", "manager", "employee"], module: "leave" },
      { href: "/leave/calendar", label: "Leave calendar", icon: "🗓️", roles: ["admin", "secretary", "manager", "employee"], module: "leave-calendar" },
      { href: "/attendance", label: "Attendance", icon: "⏱️", roles: ["admin", "secretary", "manager", "employee"], module: "attendance" },
      { href: "/payroll", label: "Payroll", icon: "💰", roles: ["admin"], module: "payroll" },
      { href: "/my-payslips", label: "My Payslips", icon: "📄", roles: ["admin", "secretary", "manager", "employee"], module: "my-payslips" },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/petty-cash", label: "Petty Cash", icon: "💵", roles: ["admin", "secretary", "manager", "employee"], module: "petty-cash" },
      { href: "/cars", label: "Car Logs", icon: "🚗", roles: ["admin", "manager"], module: "cars" },
    ],
  },
  {
    title: "Accounting",
    items: [
      { href: "/accounting", label: "Accounting", icon: "📒", roles: ["admin", "secretary", "manager"], module: "accounting" },
      { href: "/accounting/chart", label: "Chart of accounts", icon: "🧮", roles: ["admin", "secretary", "manager"], module: "chart-of-accounts" },
      { href: "/accounting/customers", label: "Customers", icon: "👤", roles: ["admin", "secretary", "manager"], module: "customers" },
      { href: "/invoices", label: "Invoices", icon: "🧾", roles: ["admin", "secretary", "manager"], module: "invoices" },
      { href: "/accounting/receipts", label: "Receipts", icon: "💳", roles: ["admin", "secretary", "manager"], module: "receipts" },
      { href: "/accounting/suppliers", label: "Suppliers", icon: "🏭", roles: ["admin", "secretary", "manager"], module: "suppliers" },
      { href: "/bills", label: "Bills", icon: "🧾", roles: ["admin", "secretary", "manager"], module: "bills" },
      { href: "/accounting/payments", label: "Payments", icon: "💸", roles: ["admin", "secretary", "manager"], module: "payments" },
      { href: "/accounting/credit-notes", label: "Credit notes", icon: "📝", roles: ["admin", "secretary"], module: "accounting" },
      { href: "/accounting/aging", label: "Aging", icon: "⏳", roles: ["admin", "secretary", "manager"], module: "accounting" },
    ],
  },
  {
    title: "Reporting",
    items: [
      { href: "/reports", label: "Reports", icon: "📈", roles: ["admin", "secretary"], module: "reports" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/tasks", label: "Tasks", icon: "✅", roles: ["admin", "secretary", "manager", "employee"], module: "tasks" },
      { href: "/meetings", label: "Meetings", icon: "📅", roles: ["admin", "secretary"], module: "meetings" },
      { href: "/minutes", label: "Minutes", icon: "📝", roles: ["admin", "secretary"], module: "minutes" },
      { href: "/visitors", label: "Visitors", icon: "🛎️", roles: ["admin", "secretary"], module: "visitors" },
      { href: "/assets", label: "Assets", icon: "📦", roles: ["admin", "secretary"], module: "assets" },
    ],
  },
  {
    title: "Company",
    items: [
      { href: "/organization", label: "Branding & Company", icon: "🎨", roles: ["admin", "secretary"], module: "organization" },
      { href: "/organization/permissions", label: "Roles & permissions", icon: "🔐", roles: ["admin"], module: "organization", always: true },
      { href: "/audit-log", label: "Audit log", icon: "🕵️", roles: ["admin"], module: "audit-log" },
      { href: "/documents", label: "Documents", icon: "📁", roles: ["admin", "secretary", "manager", "employee"], module: "documents" },
      { href: "/profile", label: "My Profile", icon: "🙋", roles: ["admin", "secretary", "manager", "employee"], module: "profile" },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/**
 * The single most-specific nav href matching the current path. This prevents a
 * parent link (e.g. /leave or /organization) from being highlighted at the same
 * time as a more specific child link (/leave/calendar, /organization/permissions).
 */
function mostSpecificHref(pathname: string): string | null {
  let best: string | null = null;
  for (const item of ALL_NAV_ITEMS) {
    const matches = pathname === item.href || pathname.startsWith(item.href + "/");
    if (matches && (best === null || item.href.length > best.length)) best = item.href;
  }
  return best;
}

export default function Sidebar({ session }: { session: SessionPayload }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [org, setOrg] = useState<ApiOrg | null>(null);
  const [granted, setGranted] = useState<string[] | null>(null);

  useEffect(() => {
    api<ApiOrg>("/api/organization")
      .then(setOrg)
      .catch(() => setOrg(null));
    if (session.role !== "super_admin") {
      api<{ modules: string[] }>("/api/permissions/mine")
        .then((d) => setGranted(d.modules))
        .catch(() => setGranted(null));
    }
  }, [session.role]);

  // Collapsible groups, remembered across visits.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem("om_nav_collapsed");
      if (raw) setCollapsed(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* ignore */
    }
  }, []);
  function toggleGroup(title: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      try {
        localStorage.setItem("om_nav_collapsed", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const activeHref = mostSpecificHref(pathname);

  const groups = NAV_GROUPS.map((g) => ({
    title: g.title,
    items: g.items.filter((n) => {
      // Admin-control pages (roles & permissions) stay visible only to the
      // built-in roles that list them.
      if (n.always) return n.roles.includes(session.role);
      // While the effective module list is loading, fall back to the role map.
      if (granted === null) return n.roles.includes(session.role);
      // Once loaded, visibility is driven by the effective grants — this also
      // covers company-defined (custom) roles, which never appear in the map.
      return granted.includes(n.module);
    }),
  })).filter((g) => g.items.length > 0);
  const orgName = org?.name || "Office Manager";

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden print:hidden">
        <span className="truncate font-bold text-indigo-700">{orgName}</span>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <UserMenu compact name={session.name} role={session.role} />
          <button
            className="btn-secondary px-3 py-1.5"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
          >
            ☰
          </button>
        </div>
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-slate-900 text-slate-100 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 print:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-5">
          {org?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt={`${orgName} logo`} className="h-9 w-9 rounded-lg object-contain" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              {orgName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="max-w-[10rem] truncate text-sm font-bold leading-tight">{orgName}</p>
            <p className="text-xs text-slate-400">{session.name}</p>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
          {groups.map((g) => {
            const hasActive = g.items.some((i) => i.href === activeHref);
            const isOpen = !collapsed[g.title] || hasActive;
            return (
              <div key={g.title}>
                <button
                  type="button"
                  onClick={() => toggleGroup(g.title)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 transition hover:text-slate-200"
                >
                  {g.title}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="mt-1 space-y-1">
                    {g.items.map((item) => {
                      const active = item.href === activeHref;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                            active ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                          }`}
                        >
                          <span aria-hidden="true">{item.icon}</span>
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 px-5 py-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
            <Link href="/terms" className="transition hover:text-white">Terms</Link>
            <Link href="/privacy" className="transition hover:text-white">Privacy</Link>
            <Link href="/cookie-policy" className="transition hover:text-white">Cookies</Link>
            <CookieSettingsButton className="transition hover:text-white">Cookie settings</CookieSettingsButton>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
