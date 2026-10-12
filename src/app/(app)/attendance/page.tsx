"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, Alert, Modal, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useSession } from "@/components/SessionProvider";
import { usePermissions } from "@/components/usePermissions";

interface AttendRec {
  id: string;
  user_id: string;
  name: string;
  date: string;
  clock_in_at: number;
  clock_out_at: number | null;
  worked_minutes: number;
  late: boolean;
  overtime_minutes: number;
  note: string | null;
}
interface SummaryRow {
  user_id: string;
  name: string;
  days_present: number;
  worked_hours: number;
  overtime_hours: number;
  late_days: number;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function fmtTime(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function fmtHours(min: number): string {
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}
/** EAT "HH:MM" for a timestamp (for the correction form). */
function toHHMM(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms + 3 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export default function AttendancePage() {
  const session = useSession();
  const toast = useToast();
  const { can } = usePermissions();
  const isAdmin = session?.role === "admin" || session?.role === "secretary" || session?.role === "manager";
  const canManage = can("attendance-manage");
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [records, setRecords] = useState<AttendRec[]>([]);
  const [summary, setSummary] = useState<SummaryRow[] | null>(null);
  const [today, setToday] = useState<{ clock_in_at: number; clock_out_at: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fix, setFix] = useState<AttendRec | "new" | null>(null);
  const [fixForm, setFixForm] = useState({ userId: "", date: "", clockIn: "", clockOut: "", note: "" });
  const [fixBusy, setFixBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{
        records: AttendRec[];
        today: { clock_in_at: number; clock_out_at: number | null } | null;
        summary: SummaryRow[] | null;
      }>(`/api/attendance?month=${month}&year=${year}`);
      setRecords(data.records);
      setToday(data.today);
      setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load attendance");
    }
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const status = useMemo(() => {
    if (!today) return { label: "Not clocked in", tone: "bg-slate-100 text-slate-600" };
    if (!today.clock_out_at) return { label: `Clocked in at ${fmtTime(today.clock_in_at)}`, tone: "bg-emerald-50 text-emerald-700" };
    return { label: `Done — ${fmtTime(today.clock_in_at)} to ${fmtTime(today.clock_out_at)}`, tone: "bg-blue-50 text-blue-700" };
  }, [today]);

  async function clock(action: "in" | "out") {
    setBusy(true);
    try {
      await api("/api/attendance", { method: "POST", json: { action } });
      toast.success(action === "in" ? "Clocked in" : "Clocked out");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  function openFix(rec: AttendRec | "new") {
    if (rec === "new") {
      setFixForm({ userId: "", date: `${year}-${String(month).padStart(2, "0")}-01`, clockIn: "", clockOut: "", note: "" });
    } else {
      setFixForm({
        userId: rec.user_id,
        date: rec.date,
        clockIn: toHHMM(rec.clock_in_at),
        clockOut: rec.clock_out_at ? toHHMM(rec.clock_out_at) : "",
        note: rec.note ?? "",
      });
    }
    setFix(rec);
  }

  async function submitFix() {
    if (!fix) return;
    if (!fixForm.userId) return toast.error("Select an employee");
    if (!fixForm.date) return toast.error("Pick a date");
    if (!fixForm.clockIn) return toast.error("Clock-in time is required");
    setFixBusy(true);
    try {
      await api("/api/attendance/correct", {
        method: "POST",
        json: {
          user_id: fixForm.userId,
          date: fixForm.date,
          clock_in: fixForm.clockIn,
          clock_out: fixForm.clockOut === "" ? null : fixForm.clockOut,
          note: fixForm.note,
        },
      });
      toast.success("Attendance saved");
      setFix(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setFixBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Attendance" subtitle="Clock in and out, and review hours, lateness and overtime." />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      {/* Clock card */}
      <div className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Today</p>
          <p className="mt-1 text-lg font-bold text-slate-800">{status.label}</p>
          <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.tone}`}>
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short", year: "numeric" })}
          </span>
        </div>
        <div>
          {!today ? (
            <button className="btn-primary px-6 py-3" onClick={() => clock("in")} disabled={busy}>Clock in</button>
          ) : !today.clock_out_at ? (
            <button className="btn-danger px-6 py-3" onClick={() => clock("out")} disabled={busy}>Clock out</button>
          ) : (
            <span className="text-sm font-medium text-slate-500">See you tomorrow</span>
          )}
        </div>
      </div>

      {/* Month picker */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className="input w-40" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" className="input w-28" value={year} min={2000} max={2100} onChange={(e) => setYear(Number(e.target.value))} />
        {canManage && (
          <button className="btn-secondary ml-auto" onClick={() => openFix("new")}>Manual entry</button>
        )}
      </div>

      {/* Team summary (admins) */}
      {isAdmin && summary && summary.length > 0 && (
        <div className="card mb-6 overflow-x-auto">
          <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">Monthly summary — {MONTHS[month - 1]} {year}</h2>
          <table className="table-base">
            <thead>
              <tr><th>Employee</th><th className="text-right">Days present</th><th className="text-right">Hours worked</th><th className="text-right">Overtime</th><th className="text-right">Late days</th></tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.user_id}>
                  <td className="font-medium">{s.name}</td>
                  <td className="text-right">{s.days_present}</td>
                  <td className="text-right">{s.worked_hours}</td>
                  <td className="text-right text-emerald-700">{s.overtime_hours}</td>
                  <td className="text-right text-amber-700">{s.late_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Records */}
      <div className="card overflow-x-auto">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">Records</h2>
        <table className="table-base">
          <thead>
            <tr><th>Date</th>{isAdmin && <th>Employee</th>}<th>In</th><th>Out</th><th className="text-right">Worked</th><th>Flags</th>{canManage && <th></th>}</tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">{r.date}</td>
                {isAdmin && <td className="font-medium">{r.name}</td>}
                <td>{fmtTime(r.clock_in_at)}</td>
                <td>{fmtTime(r.clock_out_at)}</td>
                <td className="text-right">{r.clock_out_at ? fmtHours(r.worked_minutes) : "—"}</td>
                <td>
                  <span className="inline-flex gap-1">
                    {r.late && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Late</span>}
                    {r.overtime_minutes > 0 && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">OT {fmtHours(r.overtime_minutes)}</span>}
                  </span>
                </td>
                {canManage && (
                  <td className="text-right">
                    <button className="text-xs font-semibold text-indigo-600 hover:underline" onClick={() => openFix(r)}>Fix</button>
                  </td>
                )}
              </tr>
            ))}
            {records.length === 0 && (
              <tr><td colSpan={(isAdmin ? 6 : 5) + (canManage ? 1 : 0)} className="py-8 text-center text-sm text-slate-500">No attendance recorded for this month.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {fix && (
        <Modal title={fix === "new" ? "Add attendance record" : "Correct attendance"} onClose={() => setFix(null)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Employee</label>
              <select
                className="input"
                value={fixForm.userId}
                disabled={fix !== "new"}
                onChange={(e) => setFixForm({ ...fixForm, userId: e.target.value })}
              >
                <option value="">Select…</option>
                {(summary ?? []).map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Date</label>
              <input type="date" className="input" value={fixForm.date} onChange={(e) => setFixForm({ ...fixForm, date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Clock in</label>
                <input type="time" className="input" value={fixForm.clockIn} onChange={(e) => setFixForm({ ...fixForm, clockIn: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Clock out</label>
                <input type="time" className="input" value={fixForm.clockOut} onChange={(e) => setFixForm({ ...fixForm, clockOut: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Note (optional)</label>
              <input className="input" value={fixForm.note} onChange={(e) => setFixForm({ ...fixForm, note: e.target.value })} placeholder="Reason for correction" />
            </div>
            <p className="text-xs text-slate-500">Leave clock-out blank to re-open the day. The correction is recorded in the audit log.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-secondary" onClick={() => setFix(null)} disabled={fixBusy}>Cancel</button>
              <button className="btn-primary" onClick={submitFix} disabled={fixBusy}>{fixBusy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
