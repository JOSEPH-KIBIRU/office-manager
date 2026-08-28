"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { StatusBadge, api } from "@/components/ui";
import type { LeaveRow } from "@/lib/types";

interface DashData {
  stats: {
    leave_balance: number;
    my_pending_leaves: number;
    days_taken_this_year: number;
    leave_taken_pct: number;
    pending_approvals: number;
    pending_leaves: number;
    pending_car_logs: number;
    pending_petty_cash: number;
    pending_petty_cash_amount: number;
    pending_car_logs_amount: number;
    team_size: number;
    meetings_this_week: number;
    meetings_total: number;
    petty_cash_this_month: number;
    car_logs_this_month: number;
    leave_requests_total: number;
  };
  pending_leaves_list: LeaveRow[];
  upcoming_meetings: {
    id: string;
    title: string;
    scheduled_at: string;
    location: string | null;
    created_by_name: string;
  }[];
  activity: {
    id: string;
    type: string;
    title: string;
    body: string;
    time: string;
    link: string;
  }[];
}

const ACTIVITY_STYLES: Record<string, { chip: string; icon: string; label: string }> = {
  leave: { chip: "bg-blue-100 text-blue-700", icon: "🌴", label: "Leave" },
  car: { chip: "bg-emerald-100 text-emerald-700", icon: "🚗", label: "Car" },
  petty: { chip: "bg-orange-100 text-orange-700", icon: "💵", label: "Petty cash" },
  meeting: { chip: "bg-violet-100 text-violet-700", icon: "📅", label: "Meeting" },
  payroll: { chip: "bg-teal-100 text-teal-700", icon: "💰", label: "Payroll" },
  minutes: { chip: "bg-slate-200 text-slate-700", icon: "📝", label: "Minutes" },
};

function timeAgo(s: string) {
  const t = new Date(s.replace(" ", "T")).getTime();
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const fmtKsh = (n: number) =>
  "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const TODAY = new Date().toLocaleDateString("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function fmtDate(s: string) {
  return new Date(s.replace(" ", "T")).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function fmtDay(s: string) {
  return new Date(s.replace(" ", "T")).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/* ---------- Icons (inline SVG, stroke currentColor) ---------- */
const paths = {
  calendar: "M8 2v3m8-3v3M3 8h18M4 4h16a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z",
  users: "M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm9 8a3 3 0 0 0 0 6",
  clock: "M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  wallet: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm18 3h-5a2 2 0 0 0 0 4h5",
  car: "M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11M3 11h18v5H3v-5Zm5 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  check: "M5 13l4 4L19 7",
  clipboard: "M9 5h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h2V6a1 1 0 0 1 1-1Zm5 4h-4m4 4H8m4 4H8",
  arrow: "M5 12h14m-6-6 6 6-6 6",
};

function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}

/* ---------- Stat card ---------- */
function StatCard({
  label,
  value,
  caption,
  icon,
  accent,
}: {
  label: string;
  value: string;
  caption?: string;
  icon: string;
  accent: string; // tailwind chip classes e.g. "bg-blue-100 text-blue-700"
}) {
  return (
    <div className="card group relative overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className={`absolute right-0 top-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full opacity-10 ${accent.split(" ")[0]}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1.5 text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
          {caption && <p className="mt-1 text-xs text-slate-400">{caption}</p>}
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${accent}`}>
          <Icon d={icon} className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

/* ---------- Dashboard row for day/time ---------- */
function HeroBanner({ name, role }: { name: string; role: string }) {
  const firstName = name.split(" ")[0];
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-600 p-6 text-white shadow-md sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/10" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-100">{TODAY}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Welcome back, {firstName} 👋</h1>
          <p className="mt-2 max-w-xl text-sm text-blue-100">
            Here's what's happening around the office today. You're logged in as{" "}
            <span className="rounded-md bg-white/15 px-1.5 py-0.5 font-semibold capitalize">{role.replace("_", " ")}</span>.
          </p>
        </div>
        <a
          href="/meetings"
          className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow transition hover:bg-blue-50"
        >
          Schedule a meeting
          <Icon d={paths.arrow} className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

function LeaveUtilisation({ balance, taken, pct }: { balance: number; taken: number; pct: number }) {
  const bar = Math.min(100, pct);
  const color = bar >= 85 ? "bg-red-500" : bar >= 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Icon d={paths.calendar} className="h-4 w-4 text-blue-600" />
          Leave utilisation
        </div>
        <StatusBadge status={bar >= 85 ? "cancelled" : bar >= 60 ? "pending" : "approved"} />
      </div>
      <div className="mt-4 flex items-end justify-between">
        <p className="text-3xl font-extrabold text-slate-900">
          {balance}<span className="text-base font-semibold text-slate-400"> / 21 days left</span>
        </p>
        <p className="text-xs text-slate-400">{taken} day(s) taken this year</p>
      </div>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${bar}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-400">
        <span>{bar}% used</span>
        <span>21 days</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const session = useSession();
  const [data, setData] = useState<DashData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = session?.role === "admin";

  async function load() {
    try {
      setData(await api<DashData>("/api/dashboard"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }
  useEffect(() => { load(); }, []);

  async function decide(id: string, action: "approve" | "reject") {
    try {
      await api(`/api/leaves/${id}`, { method: "PATCH", json: { action } });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Action failed");
    }
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return (
    <div className="space-y-6">
      <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200" />)}
      </div>
    </div>
  );

  const s = data.stats;

  const stats: Array<{ label: string; value: string; caption?: string; icon: string; accent: string }> = [
    { label: "Days taken this year", value: String(s.days_taken_this_year), caption: `${s.my_pending_leaves} awaiting approval`, icon: paths.calendar, accent: "bg-blue-100 text-blue-700" },
    { label: "Meetings this week", value: String(s.meetings_this_week), caption: `${s.meetings_total} scheduled in total`, icon: paths.users, accent: "bg-violet-100 text-violet-700" },
    ...(isAdmin
      ? [
          { label: "Pending approvals", value: String(s.pending_approvals), caption: `${s.pending_leaves} leave · ${s.pending_car_logs} car · ${s.pending_petty_cash} petty cash`, icon: paths.check, accent: "bg-amber-100 text-amber-700" },
          { label: "Active staff", value: String(s.team_size), caption: "team members", icon: paths.users, accent: "bg-emerald-100 text-emerald-700" },
          { label: "Pending car log value", value: fmtKsh(s.pending_car_logs_amount), caption: `${s.pending_car_logs} requistion(s)`, icon: paths.car, accent: "bg-emerald-100 text-emerald-700" },
          { label: "Pending petty cash", value: fmtKsh(s.pending_petty_cash_amount), caption: `${s.pending_petty_cash} request(s)`, icon: paths.wallet, accent: "bg-orange-100 text-orange-700" },
        ]
      : [
          { label: "Leave requests this year", value: String(s.leave_requests_total), caption: "sent from the team", icon: paths.clipboard, accent: "bg-teal-100 text-teal-700" },
          { label: "Active staff", value: String(s.team_size), caption: "team members", icon: paths.users, accent: "bg-emerald-100 text-emerald-700" },
        ]),
  ].slice(0, 4);

  const quickActions = [
    { href: "/leave", label: "Request leave", icon: paths.calendar, accent: "bg-blue-100 text-blue-700" },
    { href: "/car-logs", label: "Log car expense", icon: paths.car, accent: "bg-emerald-100 text-emerald-700" },
    { href: "/petty-cash", label: "Petty cash request", icon: paths.wallet, accent: "bg-orange-100 text-orange-700" },
    { href: "/meetings", label: "Book a meeting", icon: paths.check, accent: "bg-violet-100 text-violet-700" },
  ];

  return (
    <>
      <HeroBanner name={session?.name ?? ""} role={session?.role ?? ""} />

      {/* Leave utilisation (always visible) */}
      <LeaveUtilisation balance={s.leave_balance} taken={s.days_taken_this_year} pct={s.leave_taken_pct} />

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((card, i) => (
          <div key={i} style={{ animationDelay: `${i * 60}ms` }} className="animate-[fadeup_.4s_ease-out_both]">
            <StatCard {...card} />
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickActions.map((q) => (
            <a
              key={q.href}
              href={q.href}
              className="card group flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${q.accent} transition group-hover:scale-110`}>
                <Icon d={q.icon} className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-slate-700">{q.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Panels */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {isAdmin && (
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-800">Leave requests awaiting approval</h2>
              <a href="/leave" className="text-sm font-medium text-blue-700 hover:underline">View all →</a>
            </div>
            {data.pending_leaves_list.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                  <Icon d={paths.check} className="h-6 w-6" />
                </span>
                <p className="mt-3 text-sm font-medium text-slate-500">All caught up!</p>
                <p className="text-xs text-slate-400">No pending leave requests.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.pending_leaves_list.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div>
                      <p className="font-medium text-slate-800">{l.requester_name}</p>
                      <p className="text-sm text-slate-500">
                        <span className="capitalize">{l.leave_type}</span> · {l.days} day(s) · {l.start_date} → {l.end_date}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => decide(l.id, "approve")} className="btn-success px-3 py-1.5">Approve</button>
                      <button onClick={() => decide(l.id, "reject")} className="btn-danger px-3 py-1.5">Reject</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className={`card overflow-hidden ${isAdmin ? "" : "lg:col-span-2"}`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-800">Upcoming meetings</h2>
            <a href="/meetings" className="text-sm font-medium text-blue-700 hover:underline">View all →</a>
          </div>
          {data.upcoming_meetings.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-violet-50 text-violet-600">
                <Icon d={paths.calendar} className="h-6 w-6" />
              </span>
              <p className="mt-3 text-sm font-medium text-slate-500">Nothing scheduled</p>
              <p className="text-xs text-slate-400">No upcoming meetings right now.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.upcoming_meetings.map((m) => (
                <li key={m.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-600 text-center text-white">
                    <div>
                      <p className="text-base font-extrabold leading-none">{fmtDay(m.scheduled_at).split(" ")[0]}</p>
                      <p className="text-[11px] uppercase leading-tight">{fmtDay(m.scheduled_at).split(" ")[1]}</p>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">{m.title}</p>
                    <p className="text-sm text-slate-500">
                      {fmtDate(m.scheduled_at)} · {m.location || "Location TBD"}
                    </p>
                  </div>
                  <StatusBadge status="scheduled" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Recent activity feed */}
      <div className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-800">Recent activity</h2>
          <span className="text-xs text-slate-400">Across the whole office</span>
        </div>
        {data.activity.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">No activity yet — things you do will show up here.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.activity.map((a) => {
              const style = ACTIVITY_STYLES[a.type] || { chip: "bg-slate-100 text-slate-600", icon: "🔔", label: a.type };
              return (
                <li key={a.id} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-base ${style.chip}`}>{style.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{a.title}</p>
                    <p className="truncate text-sm text-slate-500">{a.body}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-slate-400">{timeAgo(a.time)}</span>
                    <a href={a.link} className="text-xs font-medium text-blue-700 hover:underline">Open →</a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
