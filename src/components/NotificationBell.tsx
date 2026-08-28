"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/ui";

interface NotifItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

interface NotifData {
  unread_count: number;
  items: NotifItem[];
}

const TYPE_STYLES: Record<string, string> = {
  leave: "bg-blue-100 text-blue-700",
  car: "bg-emerald-100 text-emerald-700",
  petty: "bg-orange-100 text-orange-700",
  meeting: "bg-violet-100 text-violet-700",
  payroll: "bg-teal-100 text-teal-700",
};

const TYPE_ICONS: Record<string, string> = {
  leave: "🌴",
  car: "🚗",
  petty: "💵",
  meeting: "📅",
  payroll: "💰",
};

export default function NotificationBell() {
  const router = useRouter();
  const [data, setData] = useState<NotifData | null>(null);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      setData(await api<NotifData>("/api/notifications"));
    } catch {
      /* ignore polling errors */
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const unread = data?.unread_count ?? 0;

  async function readAndGo(item: NotifItem) {
    if (!item.read) {
      try {
        await api(`/api/notifications/${item.id}`, { method: "PATCH" });
        setData((d) =>
          d ? { ...d, unread_count: Math.max(0, d.unread_count - 1), items: d.items.map((i) => (i.id === item.id ? { ...i, read: true } : i)) } : d
        );
      } catch {}
    }
    setOpen(false);
    if (item.link) router.push(item.link);
  }

  async function markAll() {
    try {
      await api("/api/notifications", { method: "POST" });
      await load();
    } catch {}
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-10 w-10 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        aria-label="Notifications"
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs font-medium text-blue-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {!data ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">Loading…</p>
            ) : data.items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">You're all caught up 🎉</p>
            ) : (
              data.items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => readAndGo(n)}
                  className={`flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 ${
                    n.read ? "opacity-60" : ""
                  }`}
                >
                  <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm ${TYPE_STYLES[n.type] || "bg-slate-100 text-slate-600"}`}>
                    {TYPE_ICONS[n.type] || "🔔"}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold ${n.read ? "text-slate-600" : "text-slate-900"}`}>{n.title}</span>
                    {n.body && <span className="block text-xs text-slate-500">{n.body}</span>}
                    <span className="mt-0.5 block text-[11px] text-slate-400">{n.created_at}</span>
                  </span>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}
