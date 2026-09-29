"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Alert, api } from "@/components/ui";
import { useSession } from "@/components/SessionProvider";

/* ----------------------------- types ----------------------------- */

interface SeriesPoint {
  month: string;
  requests?: number;
  approved?: number;
  days?: number;
  committed?: number;
  total?: number;
  completed?: number;
  cancelled?: number;
}

interface FinancePoint {
  month: string;
  revenue: number;
  collected: number;
  bills: number;
  payroll: number;
  net: number;
}

interface AnalyticsData {
  months: string[];
  scope: "organization" | "personal";
  leave: SeriesPoint[];
  petty_cash: SeriesPoint[];
  car_logs: SeriesPoint[];
  meetings: SeriesPoint[];
  finance: FinancePoint[];
  summary: {
    leave_pending: number;
    leave_days_approved: number;
    petty_spend: number;
    petty_pending: number;
    car_spend: number;
    car_pending: number;
    meetings_held: number;
    meetings_upcoming: number;
    team_size: number;
    revenue_total: number;
    collected_total: number;
    outstanding_total: number;
    bills_total: number;
    payroll_total: number;
    net_total: number;
  };
}

/* ----------------------------- helpers ----------------------------- */

const fmtKsh = (n: number) =>
  "KES " + Math.round(n).toLocaleString("en-KE", { maximumFractionDigits: 0 });

function shortKsh(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + "k";
  return String(Math.round(n));
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return `${MONTH_ABBR[mo - 1]} ${String(y).slice(2)}`;
}

/* --------------------------- tiny icons --------------------------- */

const paths = {
  calendar: "M8 2v3m8-3v3M3 8h18M4 4h16a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z",
  users: "M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm9 8a3 3 0 0 0 0 6",
  wallet: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm18 3h-5a2 2 0 0 0 0 4h5",
  car: "M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11M3 11h18v5H3v-5Zm5 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  chart: "M4 20V10m5 10V4m5 16v-7m5 7v-4",
  trend: "M3 17l6-6 4 4 8-8m0 0h-5m5 0v5",
  invoice: "M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2Z",
};

function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}

/* ----------------------------- KPI card ----------------------------- */

function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
  index,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  accent: string;
  index: number;
}) {
  return (
    <div
      className="card group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/70"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="animate-[fadeup_.4s_ease-out_both]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-slate-500">{label}</p>
            <p className="mt-1.5 truncate text-[26px] font-extrabold tracking-tight text-slate-900">{value}</p>
            {sub && <p className="mt-1 truncate text-xs font-medium text-slate-400">{sub}</p>}
          </div>
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${accent}`}>
            <Icon d={icon} className="h-5 w-5" />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- SVG line chart ----------------------------- */

function AreaChart({
  series,
  label,
}: {
  series: Array<{ month: string; value: number }>;
  label: string;
}) {
  const W = 720;
  const H = 220;
  const padL = 44;
  const padR = 12;
  const padT = 14;
  const padB = 30;
  const n = series.length;
  const max = Math.max(1, ...series.map((s) => s.value));
  const niceMax = max * 1.15;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const pt = (i: number, v: number) => {
    const x = n === 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW;
    const y = padT + innerH * (1 - v / niceMax);
    return { x, y };
  };

  const points = series.map((s, i) => pt(i, s.value));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area =
    line + ` L${points[points.length - 1].x.toFixed(1)},${(padT + innerH).toFixed(1)} L${points[0].x.toFixed(1)},${(padT + innerH).toFixed(1)} Z`;
  const last = points[points.length - 1];

  const gridFracs = [0, 0.25, 0.5, 0.75, 1];
  const gridLines = gridFracs.map((f) => padT + innerH * f);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
      <defs>
        <linearGradient id={`grad-${label.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridFracs.map((f, i) => {
        const y = gridLines[i];
        const v = niceMax * (1 - f);
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={i === 0 ? "0" : "3 4"} />
            <text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8">
              {shortKsh(v)}
            </text>
          </g>
        );
      })}
      <path d={area} fill={`url(#grad-${label.replace(/\s+/g, "-")})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      {last && (
        <g>
          <circle cx={last.x} cy={last.y} r="4" fill="currentColor" />
          <circle cx={last.x} cy={last.y} r="7.5" fill="currentColor" opacity="0.2" />
        </g>
      )}
      {series.map((s, i) =>
        i % 2 === 0 || i === n - 1 ? (
          <text key={s.month} x={pt(i, 0).x} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {monthLabel(s.month)}
          </text>
        ) : null
      )}
    </svg>
  );
}

/* --------------------------- grouped bars --------------------------- */

function GroupedBars({
  series,
  color,
  color2,
  label,
  legend,
}: {
  series: Array<{ month: string; a: number; b: number }>;
  color: string;
  color2: string;
  label: string;
  legend?: { a: string; b: string };
}) {
  const W = 720;
  const H = 220;
  const padL = 8;
  const padR = 8;
  const padT = 14;
  const padB = 30;
  const n = series.length;
  const max = Math.max(1, ...series.flatMap((s) => [s.a, s.b]));
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const groupW = innerW / n;
  const barW = Math.min(26, groupW * 0.32);
  const gap = Math.min(6, barW * 0.25);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
      {[0, 0.5, 1].map((f, i) => {
        const y = padT + innerH * f;
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8">
              {shortKsh(max * (1 - f))}
            </text>
          </g>
        );
      })}
      {series.map((s, i) => {
        const cx = padL + groupW * i + groupW / 2;
        const hA = (s.a / max) * innerH;
        const hB = (s.b / max) * innerH;
        const baseY = padT + innerH;
        return (
          <g key={s.month}>
            <rect x={cx - barW - gap / 2} y={baseY - hA} width={barW} height={hA} rx="3" fill={color} opacity="0.95">
              <title>{`${legend?.a ?? "a"}: ${shortKsh(s.a)}`}</title>
            </rect>
            <rect x={cx + gap / 2} y={baseY - hB} width={barW} height={hB} rx="3" fill={color2} opacity="0.95">
              <title>{`${legend?.b ?? "b"}: ${shortKsh(s.b)}`}</title>
            </rect>
            {(i % 2 === 0 || i === n - 1) && (
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
                {monthLabel(s.month)}
              </text>
            )}
          </g>
        );
      })}
      {legend && (
        <g>
          <rect x={W - padR - 130} y={6} width="10" height="10" rx="2" fill={color} />
          <text x={W - padR - 116} y={15} fontSize="11" fill="#64748b">
            {legend.a}
          </text>
          <rect x={W - padR - 66} y={6} width="10" height="10" rx="2" fill={color2} />
          <text x={W - padR - 52} y={15} fontSize="11" fill="#64748b">
            {legend.b}
          </text>
        </g>
      )}
    </svg>
  );
}

/* --------------------------- single bars --------------------------- */

function SingleBars({
  series,
  color,
  label,
  unit,
}: {
  series: Array<{ month: string; value: number }>;
  color: string;
  label: string;
  unit?: string;
}) {
  const W = 720;
  const H = 190;
  const padL = 8;
  const padR = 8;
  const padT = 18;
  const padB = 26;
  const n = series.length;
  const max = Math.max(1, ...series.map((s) => s.value));
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const barW = Math.min(30, (innerW / n) * 0.52);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
      {series.map((s, i) => {
        const cx = padL + (innerW / n) * i + innerW / n / 2;
        const h = (s.value / max) * innerH;
        const baseY = padT + innerH;
        return (
          <g key={s.month}>
            <rect x={cx - barW / 2} y={baseY - Math.max(h, s.value > 0 ? 2 : 0)} width={barW} height={Math.max(h, s.value > 0 ? 2 : 0)} rx="3" fill={color}>
              <title>{`${monthLabel(s.month)}: ${s.value}${unit ?? ""}`}</title>
            </rect>
            {s.value > 0 && (
              <text x={cx} y={baseY - h - 6} textAnchor="middle" fontSize="10" fontWeight="600" fill="#475569">
                {`${s.value}${unit ?? ""}`}
              </text>
            )}
            {(i % 2 === 0 || i === n - 1) && (
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="#94a3b8">
                {monthLabel(s.month)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ----------------------------- chart card ----------------------------- */

function ChartCard({
  title,
  subtitle,
  children,
  accent,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="card flex flex-col overflow-hidden p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${accent}`}>
          <Icon d={paths.chart} className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------ page ------------------------------ */

export default function AnalyticsPage() {
  const session = useSession();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<AnalyticsData>("/api/analytics")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const isOrg = session?.role === "admin";

  const kpis = useMemo(() => {
    if (!data) return [];
    const s = data.summary;
    return isOrg
      ? [
          {
            label: "Days of leave approved",
            value: String(s.leave_days_approved),
            sub: `${s.leave_pending} request(s) pending`,
            icon: paths.calendar,
            accent: "bg-blue-50 text-blue-600",
          },
          {
            label: "Petty cash committed",
            value: fmtKsh(s.petty_spend),
            sub: `${s.petty_pending} pending request(s)`,
            icon: paths.wallet,
            accent: "bg-amber-50 text-amber-600",
          },
          {
            label: "Fleet spend approved",
            value: fmtKsh(s.car_spend),
            sub: `${s.car_pending} pending log(s)`,
            icon: paths.car,
            accent: "bg-emerald-50 text-emerald-600",
          },
          {
            label: "Team size",
            value: String(s.team_size),
            sub: `${s.meetings_upcoming} meeting(s) coming up`,
            icon: paths.users,
            accent: "bg-violet-50 text-violet-600",
          },
        ]
      : [
          {
            label: "My leave days approved",
            value: String(s.leave_days_approved),
            sub: `${s.leave_pending} request(s) pending`,
            icon: paths.calendar,
            accent: "bg-blue-50 text-blue-600",
          },
          {
            label: "My petty cash committed",
            value: fmtKsh(s.petty_spend),
            sub: `${s.petty_pending} pending request(s)`,
            icon: paths.wallet,
            accent: "bg-amber-50 text-amber-600",
          },
          {
            label: "My fleet spend",
            value: fmtKsh(s.car_spend),
            sub: `${s.car_pending} pending log(s)`,
            icon: paths.car,
            accent: "bg-emerald-50 text-emerald-600",
          },
          {
            label: "Meetings I'm in",
            value: String(s.meetings_held),
            sub: `${s.meetings_upcoming} coming up`,
            icon: paths.users,
            accent: "bg-violet-50 text-violet-600",
          },
        ];
  }, [data, isOrg]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data)
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    );

  const moneySeries = data.months.map((m, i) => ({
    month: m,
    a: data.petty_cash[i]?.committed ?? 0,
    b: data.car_logs[i]?.approved ?? 0,
  }));
  const leaveTrend = data.months.map((m, i) => ({ month: m, value: data.leave[i]?.days ?? 0 }));
  const meetingTrend = data.months.map((m, i) => ({ month: m, value: data.meetings[i]?.total ?? 0 }));
  const financeChart = data.months.map((m, i) => ({
    month: m,
    a: data.finance[i]?.revenue ?? 0,
    b: (data.finance[i]?.bills ?? 0) + (data.finance[i]?.payroll ?? 0),
  }));
  const hasFinance = isOrg && data.finance.length > 0;

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={isOrg ? "Organisation-wide activity across the last 12 months." : "Your activity across the last 12 months."}
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
            <span className={`h-2 w-2 rounded-full ${isOrg ? "bg-blue-500" : "bg-emerald-500"}`} />
            {isOrg ? "Organisation view" : "Personal view"}
          </span>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <KpiCard key={k.label} {...k} index={i} />
        ))}
      </div>

      {/* Finance (company-level only) */}
      {hasFinance && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Revenue invoiced" value={fmtKsh(data.summary.revenue_total)} sub={`${fmtKsh(data.summary.collected_total)} collected`} icon={paths.invoice} accent="bg-emerald-50 text-emerald-600" index={0} />
            <KpiCard label="Outstanding" value={fmtKsh(data.summary.outstanding_total)} sub="sent or overdue invoices" icon={paths.trend} accent="bg-amber-50 text-amber-600" index={1} />
            <KpiCard label="Bills recorded" value={fmtKsh(data.summary.bills_total)} sub={`${fmtKsh(data.summary.payroll_total)} payroll`} icon={paths.wallet} accent="bg-rose-50 text-rose-600" index={2} />
            <KpiCard label="Net (revenue − costs)" value={fmtKsh(data.summary.net_total)} sub="invoiced revenue less bills & payroll" icon={paths.chart} accent="bg-indigo-50 text-indigo-600" index={3} />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartCard title="Revenue vs costs" subtitle="Invoiced revenue vs bills + payroll" accent="bg-emerald-50 text-emerald-600">
              <div className="text-emerald-600">
                <GroupedBars series={financeChart} color="#10b981" color2="#ef4444" label="finance" legend={{ a: "Revenue", b: "Bills + payroll" }} />
              </div>
            </ChartCard>
          </div>
        </>
      )}

      {/* Main charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          title="Spend — petty cash & fleet"
          subtitle="Committed amounts per month"
          accent="bg-indigo-50 text-indigo-600"
        >
          <div className="text-indigo-600">
            <GroupedBars series={moneySeries} color="#f59e0b" color2="#10b981" label="spend" legend={{ a: "Petty cash", b: "Fleet" }} />
          </div>
        </ChartCard>

        <ChartCard title="Leave days approved" subtitle="Approved days each month" accent="bg-blue-50 text-blue-600">
          <SingleBars series={leaveTrend} color="#2563eb" label="leave days" unit="d" />
        </ChartCard>

        <ChartCard title="Meetings held" subtitle="Number of meetings each month" accent="bg-violet-50 text-violet-600">
          <SingleBars series={meetingTrend} color="#7c3aed" label="meetings" />
        </ChartCard>

        <ChartCard
          title="Spend trend"
          subtitle="Petty cash committed — rolling trend"
          accent="bg-amber-50 text-amber-600"
        >
          <div className="text-amber-500">
            <AreaChart
              label="petty trend"
              series={data.months.map((m, i) => ({ month: m, value: data.petty_cash[i]?.committed ?? 0 }))}
            />
          </div>
        </ChartCard>
      </div>
    </>
  );
}
