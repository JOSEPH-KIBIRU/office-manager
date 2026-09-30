"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import UserMenu from "@/components/UserMenu";

const NAV = [
  { href: "/admin", label: "Companies", icon: "🏢" },
  { href: "/admin/new", label: "Create company & admin", icon: "➕" },
  { href: "/admin/features", label: "Modules & features", icon: "🧩" },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: "💰" },
  { href: "/admin/audit", label: "Audit trail", icon: "🕵️" },
  { href: "/admin/announcements", label: "Announcements & offers", icon: "📢" },
  { href: "/admin/enquiries", label: "Enquiries desk", icon: "📩" },
  { href: "/admin/status", label: "System status", icon: "🩺" },
];

export default function SuperAdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 text-white lg:hidden print:hidden">
        <span className="font-bold">Platform Console</span>
        <div className="flex items-center gap-1.5">
          <UserMenu compact dark name="Super Admin" role="super_admin" />
          <button className="rounded bg-slate-800 px-3 py-1.5" onClick={() => setOpen(!open)}>☰</button>
        </div>
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-slate-900 text-slate-100 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 print:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">SA</div>
          <div>
            <p className="text-sm font-bold leading-tight">Platform Console</p>
            <p className="text-xs text-slate-400">Super Admin</p>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
