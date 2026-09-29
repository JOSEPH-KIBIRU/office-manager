"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Alert, api } from "@/components/ui";
import type { LeaveRow } from "@/lib/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function LeaveCalendarPage() {
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));

  useEffect(() => {
    api<{ leaves: LeaveRow[] }>("/api/leaves")
      .then((d) => setLeaves(d.leaves))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load leave"))
      .finally(() => setLoading(false));
  }, []);

  // Map each day of the visible month to the people on leave that day.
  const byDay = useMemo(() => {
    const map = new Map<string, LeaveRow[]>();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const key = iso(new Date(cursor.getFullYear(), cursor.getMonth(), d));
      map.set(key, []);
    }
    for (const l of leaves) {
      if (l.status === "rejected") continue;
      const start = l.start_date;
      const end = l.end_date;
      for (const [key] of map) {
        if (key >= start && key <= end) map.get(key)!.push(l);
      }
    }
    return map;
  }, [leaves, cursor]);

  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const leadingBlanks = (firstDay.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: Array<{ key: string; day: number } | null> = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ key: iso(new Date(cursor.getFullYear(), cursor.getMonth(), d)), day: d });
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = iso(new Date());

  return (
    <>
      <PageHeader
        title="Leave calendar"
        subtitle="Who's away, day by day. Approved leave is green; pending requests are amber."
        action={
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹ Prev</button>
            <button className="btn-secondary" onClick={() => setCursor(new Date(now.getFullYear(), now.getMonth(), 1))}>Today</button>
            <button className="btn-secondary" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>Next ›</button>
          </div>
        }
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="card p-4">
        <p className="mb-3 text-center text-lg font-bold text-slate-800">
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </p>
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((w) => (
              <div key={w} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">{w}</div>
            ))}
            {cells.map((cell, i) => {
              if (!cell) return <div key={`b${i}`} className="min-h-24 rounded-lg bg-slate-50/50" />;
              const items = byDay.get(cell.key) ?? [];
              const isToday = cell.key === todayKey;
              return (
                <div key={cell.key} className={`min-h-24 rounded-lg border p-1.5 ${isToday ? "border-indigo-300 bg-indigo-50/50" : "border-slate-100 bg-white"}`}>
                  <div className={`mb-1 text-right text-xs font-semibold ${isToday ? "text-indigo-700" : "text-slate-400"}`}>{cell.day}</div>
                  <div className="space-y-1">
                    {items.slice(0, 4).map((l) => (
                      <div
                        key={l.id}
                        title={`${l.requester_name ?? ""} · ${l.leave_type} · ${l.start_date}→${l.end_date} (${l.status})`}
                        className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          l.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {l.requester_name ?? "—"}
                      </div>
                    ))}
                    {items.length > 4 && <div className="px-1 text-[10px] text-slate-400">+{items.length - 4} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
