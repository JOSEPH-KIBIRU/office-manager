"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { StatusBadge, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import OnboardingChecklist from "@/components/OnboardingChecklist";
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
  leave: { chip: "bg-blue-50 text-blue-600", icon: "🌴", label: "Leave" },
  car: { chip: "bg-emerald-50 text-emerald-600", icon: "🚗", label: "Car" },
  petty: { chip: "bg-amber-50 text-amber-600", icon: "💵", label: "Petty cash" },
  meeting: { chip: "bg-violet-50 text-violet-600", icon: "📅", label: "Meeting" },
  payroll: { chip: "bg-teal-50 text-teal-600", icon: "💰", label: "Payroll" },
  minutes: { chip: "bg-slate-100 text-slate-600", icon: "📝", label: "Minutes" },
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
  "KES " + Math.round(n).toLocaleString("en-KE", { maximumFractionDigits: 0 });

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

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
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
  chartUp: "M3 17l6-6 4 4 8-8m0 0h-5m5 0v5",
  alert: "M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z",
  inbox: "M3 13h5l2 3h4l2-3h5M4 8h16M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z",
};

function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}

/* ---------- Page greeting ---------- */
function Greeting({
  name,
  role,
  isAdmin,
  pendingApprovals,
}: {
  name: string;
  role: string;
  isAdmin: boolean;
  pendingApprovals: number;
}) {
  const firstName = name.split(" ")[0];
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{TODAY}</p>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          {greeting()}, {firstName}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {isAdmin ? (
            <>
              You have <span className="font-semibold text-slate-700">{pendingApprovals} item(s)</span> waiting for your
              approval across the office.
            </>
          ) : (
            <>
              Here's what's happening around the office. You're signed in as{" "}
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold capitalize text-slate-700">
                {role.replace("_", " ")}
              </span>
              .
            </>
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href="/analytics"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          <Icon d={paths.chartUp} className="h-4 w-4 text-blue-600" />
          Analytics
        </a>
        <a
          href="/meetings"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          <Icon d={paths.calendar} className="h-4 w-4" />
          Schedule meeting
          <Icon d={paths.arrow} className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

/* ---------- Stat card ---------- */
function StatCard({
  label,
  value,
  caption,
  icon,
  tone,
  index,
  captionTone,
}: {
  label: string;
  value: string;
  caption?: string;
  icon: string;
  tone: string; // e.g. "text-blue-600 bg-blue-50"
  captionTone?: string;
  index: number;
}) {
  const [textColor] = tone.split(" ");
  return (
    <div
      className="card relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/80"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <span className={`absolute inset-x-0 top-0 h-0.5 ${textColor ? textColor.replace("text-", "bg-").split(" ")[0] : "bg-blue-600"} opacity-60`} />
      <div className="animate-[fadeup_.35s_ease-out_both]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-slate-500">{label}</p>
            <p className="mt-1.5 truncate text-[26px] font-extrabold tracking-tight text-slate-900">{value}</p>
            {caption && <p className={`mt-1 truncate text-xs ${captionTone ?? "text-slate-400"}`}>{caption}</p>}
          </div>
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}>
            <Icon d={icon} className="h-5 w-5" />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Section heading ---------- */
function SectionTitle({
  title,
  link,
  linkLabel = "View all",
  right,
}: {
  title: string;
  link?: string;
  linkLabel?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="h-4 w-1 rounded-full bg-blue-600" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">{title}</h2>
      </div>
      {right ?? (link ? <a href={link} className="text-sm font-medium text-blue-700 hover:underline">{linkLabel} →</a> : null)}
    </div>
  );
}

/* ---------- Leave utilisation card ---------- */
function LeaveUtilisation({ balance, taken, pct }: { balance: number; taken: number; pct: number }) {
  const bar = Math.min(100, pct);
  const status = bar >= 85 ? { label: "Low balance", cls: "bg-red-50 text-red-600" } : bar >= 60 ? { label: "Getting low", cls: "bg-amber-50 text-amber-600" } : { label: "Healthy", cls: "bg-emerald-50 text-emerald-600" };
  const barColor = bar >= 85 ? "bg-red-500" : bar >= 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-600">
            <Icon d={paths.calendar} className="h-4 w-4" />
          </span>
          Annual leave
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.cls}`}>{status.label}</span>
      </div>
      <div className="mt-4 flex items-end justify-between">
        <p className="text-3xl font-extrabold tracking-tight text-slate-900">
          {balance}
          <span className="text-sm font-semibold text-slate-400"> / 21 days left</span>
        </p>
        <p className="text-xs text-slate-400">{taken} day(s) taken this year</p>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${bar}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs font-medium text-slate-400">
        <span>{bar}% used</span>
        <span>{21 - balance} used · {balance} available</span>
      </div>
    </div>
  );
}

/* ---------- Empty state ---------- */
function EmptyState({ icon, tone, title, sub }: { icon: string; tone: string; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <span className={`grid h-12 w-12 place-items-center rounded-2xl ${tone}`}>
        <Icon d={icon} className="h-6 w-6" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-600">{title}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}

export default function DashboardPage() {
  const session = useSession();
  const [data, setData] = useState<DashData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = session?.role === "admin";
  const toast = useToast();

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
      toast.success(action === "approve" ? "Leave approved." : "Leave rejected.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return (
    <div className="space-y-6">
      <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />)}
      </div>
    </div>
  );

  const s = data.stats;

  const adminStats = [
    { label: "Pending approvals", value: String(s.pending_approvals), caption: `${s.pending_leaves} leave · ${s.pending_car_logs} car · ${s.pending_petty_cash} petty cash`, icon: paths.inbox, tone: "bg-amber-50 text-amber-600", captionTone: "text-slate-400" },
    { label: "Outstanding petty cash", value: fmtKsh(s.pending_petty_cash_amount), caption: `${s.pending_petty_cash} request(s) awaiting action`, icon: paths.wallet, tone: "bg-orange-50 text-orange-600", captionTone: "text-slate-400" },
    { label: "Outstanding fleet claims", value: fmtKsh(s.pending_car_logs_amount), caption: `${s.pending_car_logs} log(s) awaiting action`, icon: paths.car, tone: "bg-emerald-50 text-emerald-600", captionTone: "text-slate-400" },
    { label: "Active staff", value: String(s.team_size), caption: `${s.meetings_this_week} meeting(s) this week`, icon: paths.users, tone: "bg-indigo-50 text-indigo-600", captionTone: "text-slate-400" },
  ];

  const staffStats = [
    { label: "Leave days taken", value: String(s.days_taken_this_year), caption: "this year", icon: paths.calendar, tone: "bg-blue-50 text-blue-600" },
    { label: "Leave balance", value: String(s.leave_balance), caption: "of 21 days remaining", icon: paths.clipboard, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Meetings this week", value: String(s.meetings_this_week), caption: "across the office", icon: paths.users, tone: "bg-violet-50 text-violet-600" },
    { label: "My pending requests", value: String(s.my_pending_leaves), caption: "leave awaiting approval", icon: paths.clock, tone: "bg-amber-50 text-amber-600" },
  ];

  const stats = isAdmin ? adminStats : staffStats;

  const quickActions = isAdmin
    ? [
        { href: "/leave", label: "Review leave", desc: "Approve or decline requests", icon: paths.check, tone: "bg-blue-50 text-blue-600" },
        { href: "/petty-cash", label: "Petty cash", desc: "New request or approve", icon: paths.wallet, tone: "bg-amber-50 text-amber-600" },
        { href: "/cars", label: "Car log", desc: "Log or approve expense", icon: paths.car, tone: "bg-emerald-50 text-emerald-600" },
        { href: "/meetings", label: "Meetings", desc: "Schedule or manage", icon: paths.calendar, tone: "bg-violet-50 text-violet-600" },
      ]
    : [
        { href: "/leave", label: "Request leave", desc: "Plan time away", icon: paths.calendar, tone: "bg-blue-50 text-blue-600" },
        { href: "/petty-cash", label: "Petty cash", desc: "Request cash for office", icon: paths.wallet, tone: "bg-amber-50 text-amber-600" },
        { href: "/my-payslips", label: "Payslips", desc: "View your latest slips", icon: paths.clipboard, tone: "bg-emerald-50 text-emerald-600" },
        { href: "/meetings", label: "Meetings", desc: "See what's coming up", icon: paths.calendar, tone: "bg-violet-50 text-violet-600" },
      ];

  return (
    <>
      <Greeting
        name={session?.name ?? ""}
        role={session?.role ?? ""}
        isAdmin={isAdmin}
        pendingApprovals={s.pending_approvals}
      />

      {isAdmin && <OnboardingChecklist />}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((card, i) => (
          <StatCard key={card.label} {...card} index={i} />
        ))}
      </div>

      {/* Quick actions */}
      <div className="mt-7">
        <SectionTitle title="Quick actions" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((q) => (
            <a
              key={q.href}
              href={q.href}
              className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${q.tone} transition group-hover:scale-105`}>
                <Icon d={q.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-800">{q.label}</span>
                <span className="block truncate text-xs text-slate-400">{q.desc}</span>
              </span>
            </a>
          ))}
        </div>
      </div>

      {/* Two-column: approvals / meetings + leave utilisation */}
      <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Primary panel */}
        <section className={`card overflow-hidden ${isAdmin ? "lg:col-span-2" : "lg:col-span-2"}`}>
          <div className="border-b border-slate-100 px-5 py-4">
            <SectionTitle
              title={isAdmin ? "Leave requests awaiting approval" : "Upcoming meetings"}
              link={isAdmin ? "/leave" : "/meetings"}
              right={
                isAdmin && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                    {s.pending_leaves} open
                  </span>
                )
              }
            />
          </div>
          {isAdmin ? (
            data.pending_leaves_list.length === 0 ? (
              <EmptyState icon={paths.check} tone="bg-emerald-50 text-emerald-600" title="All caught up!" sub="No leave requests waiting for approval." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.pending_leaves_list.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-slate-50/70">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                          {(l.requester_name ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
                        </span>
                        <p className="truncate font-semibold text-slate-800">{l.requester_name ?? "Unknown"}</p>
                      </div>
                      <p className="mt-1.5 text-sm text-slate-500">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold capitalize text-slate-600">{l.leave_type}</span>{" "}
                        · {l.days} day(s) · {l.start_date} → {l.end_date}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => decide(l.id, "approve")} className="btn-success px-3 py-1.5">Approve</button>
                      <button onClick={() => decide(l.id, "reject")} className="btn-danger px-3 py-1.5">Decline</button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : data.upcoming_meetings.length === 0 ? (
            <EmptyState icon={paths.calendar} tone="bg-violet-50 text-violet-600" title="Nothing scheduled" sub="No upcoming meetings right now." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.upcoming_meetings.map((m) => (
                <li key={m.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 text-center text-white shadow-sm">
                    <div>
                      <p className="text-sm font-extrabold leading-none">{fmtDay(m.scheduled_at).split(" ")[0]}</p>
                      <p className="text-[10px] uppercase leading-tight opacity-90">{fmtDay(m.scheduled_at).split(" ")[1]}</p>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800">{m.title}</p>
                    <p className="text-sm text-slate-500">{fmtDate(m.scheduled_at)} · {m.location || "Location TBD"}</p>
                  </div>
                  <StatusBadge status="scheduled" />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          <LeaveUtilisation balance={s.leave_balance} taken={s.days_taken_this_year} pct={s.leave_taken_pct} />
          {isAdmin && (
            <div className="card p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-orange-50 text-orange-600">
                  <Icon d={paths.alert} className="h-4 w-4" />
                </span>
                Needs your attention
              </div>
              <ul className="mt-3 space-y-2.5 text-sm">
                {s.pending_petty_cash > 0 && (
                  <li className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Petty cash requests</span>
                    <span className="font-bold text-slate-800">{s.pending_petty_cash}</span>
                  </li>
                )}
                {s.pending_car_logs > 0 && (
                  <li className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Fleet (car) logs</span>
                    <span className="font-bold text-slate-800">{s.pending_car_logs}</span>
                  </li>
                )}
                {s.pending_leaves > 0 && (
                  <li className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Leave requests</span>
                    <span className="font-bold text-slate-800">{s.pending_leaves}</span>
                  </li>
                )}
                {s.pending_petty_cash + s.pending_car_logs + s.pending_leaves === 0 && (
                  <li className="text-xs text-slate-400">Nothing needs your attention. 🎉</li>
                )}
              </ul>
              <a href="/leave" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline">
                Open approvals <Icon d={paths.arrow} className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Recent activity feed */}
      <div className="card mt-7 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <SectionTitle title="Recent activity" right={<span className="text-xs text-slate-400">{isAdmin ? "Across the whole office" : "Your activity"}</span>} />
        </div>
        {data.activity.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">No activity yet — things you do will show up here.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.activity.map((a) => {
              const style = ACTIVITY_STYLES[a.type] || { chip: "bg-slate-100 text-slate-600", icon: "🔔", label: a.type };
              return (
                <li key={a.id} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50/70">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base ${style.chip}`}>{style.icon}</span>
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
