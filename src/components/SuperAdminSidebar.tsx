"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/admin", label: "Companies", icon: "🏢" },
  { href: "/admin/new", label: "Create company & admin", icon: "➕" },
];

export default function SuperAdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 text-white lg:hidden">
        <span className="font-bold">Platform Console</span>
        <button className="rounded bg-slate-800 px-3 py-1.5" onClick={() => setOpen(!open)}>☰</button>
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-slate-900 text-slate-100 transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">SA</div>
          <div>
            <p className="text-sm font-bold leading-tight">Platform Console</p>
            <p className="text-xs text-slate-400">Super Admin</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="mb-2 px-1 text-xs text-slate-400">Platform Owner</div>
          <button onClick={logout} className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700">
            Sign out
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
