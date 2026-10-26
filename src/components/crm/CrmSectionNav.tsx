"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermissions } from "@/components/usePermissions";

const SECTIONS = [
  { href: "/crm", label: "Overview", module: "crm" },
  { href: "/crm/companies", label: "Companies", module: "crm-companies" },
  { href: "/crm/contacts", label: "Contacts", module: "crm-companies" },
  { href: "/crm/leads", label: "Leads", module: "crm-leads" },
  { href: "/crm/pipeline", label: "Pipeline", module: "crm-pipeline" },
  { href: "/crm/deals", label: "Deals", module: "crm-pipeline" },
];

/** Section tabs across the CRM workspace (only the sections the user can open). */
export default function CrmSectionNav() {
  const pathname = usePathname();
  const { modules } = usePermissions();
  const granted = (m: string) => modules === null || modules.includes(m);
  const sections = SECTIONS.filter((s) => granted(s.module));

  if (sections.length < 2) return null;

  return (
    <nav aria-label="CRM sections" className="border-b border-slate-200">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {sections.map((s) => {
          const active = s.href === "/crm" ? pathname === "/crm" : pathname.startsWith(s.href);
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
