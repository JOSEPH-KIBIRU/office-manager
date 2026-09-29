"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/organization", label: "Branding" },
  { href: "/organization/working-hours", label: "Working hours" },
  { href: "/organization/invoicing", label: "Invoicing" },
  { href: "/organization/etims", label: "eTIMS (KRA)" },
  { href: "/organization/reminders", label: "Reminders" },
  { href: "/organization/leave", label: "Leave policy" },
  { href: "/organization/holidays", label: "Public holidays" },
  { href: "/organization/permissions", label: "Permissions" },
];

/** Top navigation across the "Branding & Company" section pages. */
export default function OrgSectionNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Branding and company settings" className="border-b border-slate-200">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {SECTIONS.map((s) => {
          const active = pathname === s.href;
          return (
            <li key={s.href} className="shrink-0">
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "inline-block rounded-t-lg border border-b-0 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700"
                    : "inline-block rounded-t-lg border border-transparent px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700"
                }
              >
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
