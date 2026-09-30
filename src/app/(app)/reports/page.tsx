"use client";

import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader, Alert, StatusBadge, api } from "@/components/ui";
import { OrgHeader, OrgFooter, type OrgBrandingData } from "@/components/OrgBranding";
import { printDocument } from "@/lib/print";
import ShareButton from "@/components/ShareButton";
import { useToast } from "@/components/toast";
import type { LeaveRow, CarLogRow, PettyCashRow } from "@/lib/types";

type ReportType = "leave" | "cars" | "petty" | "invoices" | "bills" | "tasks" | "visitors" | "assets";

interface ReportsData {
  leaves: LeaveRow[];
  car_logs: CarLogRow[];
  petty_cash: PettyCashRow[];
  invoices: InvoiceRow[];
  bills: BillRow[];
  tasks: TaskReportRow[];
  visitors: VisitorReportRow[];
  asset_movements: AssetMovementRow[];
}

interface AssetMovementRow {
  id: string;
  assetId: string;
  assetName: string;
  assetTag: string;
  action: "checkout" | "checkin";
  holderId: string;
  holderName: string;
  recordedByName: string | null;
  at: number;
  atText: string;
  date: string;
  destination: string | null;
  condition: string | null;
  note: string | null;
}

interface VisitorReportRow {
  id: string;
  visitorName: string;
  phone: string;
  carReg: string;
  visitorTo: string;
  visitorToName: string;
  status: string;
  createdAt: number;
}

interface TaskReportRow {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  status: string;
  assignee_id: string;
  assignee_name: string;
  created_by_name: string;
  report_count: number;
  created_at: string;
}

interface InvoiceRow {
  id: string;
  number: string;
  contact_name: string;
  issue_date: string;
  due_date: string;
  status: string;
  total: number;
}

interface BillRow {
  id: string;
  number: string;
  contact_name: string;
  bill_date: string;
  due_date: string;
  status: string;
  amount: number;
}

const fmtKsh = (n: number) =>
  "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const TYPE_LABELS: Record<ReportType, string> = {
  leave: "Leave days",
  cars: "Car logs",
  petty: "Petty cash",
  invoices: "Invoices",
  bills: "Bills",
  tasks: "Tasks",
  visitors: "Visitors",
  assets: "Asset movement",
};

function localDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtVisitDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function inRange(date: string | undefined, from: string, to: string): boolean {
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCsv(rows: string[][]) {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
}

function toExcelHtml(title: string, headers: string[], rows: string[][]) {
  const trs = rows
    .map((r) => `<tr>${r.map((c) => `<td>${String(c ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>`).join("")}</tr>`)
    .join("");
  return `<html><head><meta charset="utf-8"></head><body><h3>${title}</h3><table border="1">${headers
    .map((h) => `<th>${h}</th>`)
    .join("")}${trs}</table></body></html>`;
}

function ReportsPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<ReportsData | null>(null);
  const [org, setOrg] = useState<OrgBrandingData | null>(null);
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<ReportType>((searchParams.get("type") as ReportType) || "leave");
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const [employee, setEmployee] = useState(searchParams.get("employee") ?? "");
  const toast = useToast();

  async function load() {
    try {
      setData(await api<ReportsData>("/api/reports"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report data");
    }
    try {
      setOrg(await api<OrgBrandingData>("/api/organization"));
    } catch {
      /* optional */
    }
    try {
      const u = await api<{ users: Array<{ id: string; name: string }> }>("/api/users");
      setStaff(u.users.map((x) => ({ id: x.id, name: x.name })));
    } catch {
      /* managers may not have access — fall back to record-derived names */
    }
  }
  useEffect(() => { load(); }, []);

  const employees = useMemo(() => {
    const map = new Map<string, string>();
    // Full staff list first, so people with no records still appear.
    for (const s of staff) map.set(s.id, s.name);
    if (data) {
      for (const l of data.leaves) if (l.user_id && l.requester_name) map.set(l.user_id, l.requester_name);
      for (const c of data.car_logs) if (c.requested_by && c.requester_name) map.set(c.requested_by, c.requester_name);
      for (const p of data.petty_cash) if (p.requested_by && p.requester_name) map.set(p.requested_by, p.requester_name);
      for (const t of data.tasks ?? []) if (t.assignee_id && t.assignee_name) map.set(t.assignee_id, t.assignee_name);
      for (const v of data.visitors ?? []) if (v.visitorTo && v.visitorToName) map.set(v.visitorTo, v.visitorToName);
    for (const m of data.asset_movements ?? []) if (m.holderId && m.holderName) map.set(m.holderId, m.holderName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data, staff]);

  const scopeLabel = employee
    ? employees.find((e) => e.id === employee)?.name ?? (type === "visitors" ? "Selected host" : type === "assets" ? "Selected person" : "Selected employee")
    : type === "visitors" ? "All hosts" : type === "assets" ? "All staff" : "All employees";
  const rangeLabel = [from && `from ${from}`, to && `to ${to}`].filter(Boolean).join(" ") || "All dates";
  const generatedAt = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  const filteredLeaves = useMemo(
    () =>
      (data?.leaves ?? []).filter(
        (l) =>
          (!employee || l.user_id === employee) &&
          inRange(l.start_date, from, to)
      ),
    [data, employee, from, to]
  );
  const filteredCars = useMemo(
    () =>
      (data?.car_logs ?? []).filter(
        (c) =>
          (!employee || c.requested_by === employee) &&
          inRange(c.log_date, from, to)
      ),
    [data, employee, from, to]
  );
  const filteredPetty = useMemo(
    () =>
      (data?.petty_cash ?? []).filter(
        (p) =>
          (!employee || p.requested_by === employee) &&
          inRange(p.date_needed, from, to)
      ),
    [data, employee, from, to]
  );
  const filteredInvoices = useMemo(
    () =>
      (data?.invoices ?? []).filter((inv) => inRange(inv.issue_date, from, to)),
    [data, from, to]
  );
  const filteredBills = useMemo(
    () =>
      (data?.bills ?? []).filter((b) => inRange(b.bill_date, from, to)),
    [data, from, to]
  );
  const filteredTasks = useMemo(
    () =>
      (data?.tasks ?? []).filter(
        (t) =>
          (!employee || t.assignee_id === employee) &&
          inRange(t.due_date || t.created_at.slice(0, 10), from, to)
      ),
    [data, employee, from, to]
  );
  const filteredVisitors = useMemo(
    () =>
      (data?.visitors ?? []).filter(
        (v) =>
          (!employee || v.visitorTo === employee) &&
          inRange(localDate(v.createdAt), from, to)
      ),
    [data, employee, from, to]
  );
  const filteredAssets = useMemo(
    () =>
      (data?.asset_movements ?? []).filter(
        (m) => (!employee || m.holderId === employee) && inRange(m.date, from, to)
      ),
    [data, employee, from, to]
  );

  const leaveDays = filteredLeaves.reduce((s, l) => s + l.days, 0);
  const carTotal = filteredCars.reduce((s, c) => s + c.amount, 0);
  const pettyTotal = filteredPetty.reduce((s, p) => s + p.amount, 0);
  const invoiceTotal = filteredInvoices.reduce((s, inv) => s + inv.total, 0);
  const billTotal = filteredBills.reduce((s, b) => s + b.amount, 0);

  const shareUrl =
    `${typeof window !== "undefined" ? window.location.origin : ""}/reports?type=${type}` +
    `${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}${employee ? `&employee=${employee}` : ""}`;

  function currentRows(): { headers: string[]; rows: string[][] } {
    if (type === "leave") {
      return {
        headers: ["Employee", "Type", "Days", "From", "To", "Status"],
        rows: filteredLeaves.map((l) => [l.requester_name ?? "", l.leave_type, String(l.days), l.start_date, l.end_date, l.status]),
      };
    }
    if (type === "cars") {
      return {
        headers: ["Employee", "Vehicle", "Category", "Description", "Vendor", "Amount (KES)", "Log date", "Status"],
        rows: filteredCars.map((c) => [c.requester_name ?? "", c.vehicle_reg, c.category, c.description ?? "", c.vendor ?? "", String(c.amount), c.log_date, c.status]),
      };
    }
    if (type === "petty") {
      return {
        headers: ["Employee", "Requisition", "Amount (KES)", "Purpose", "Date needed", "Status"],
        rows: filteredPetty.map((p) => [p.requester_name ?? "", p.requisition_no ?? "", String(p.amount), p.purpose, p.date_needed, p.status]),
      };
    }
    if (type === "invoices") {
      return {
        headers: ["Number", "Customer", "Issue date", "Due date", "Total (KES)", "Status"],
        rows: filteredInvoices.map((inv) => [inv.number, inv.contact_name, inv.issue_date, inv.due_date, String(inv.total), inv.status]),
      };
    }
    if (type === "tasks") {
      return {
        headers: ["Task", "Assignee", "Priority", "Due date", "Status", "Reports", "Created"],
        rows: filteredTasks.map((t) => [
          t.title,
          t.assignee_name,
          t.priority,
          t.due_date ?? "",
          t.status,
          String(t.report_count),
          t.created_at,
        ]),
      };
    }
    if (type === "visitors") {
      return {
        headers: ["Date / time", "Visitor", "Phone", "Car registration", "Host", "Status"],
        rows: filteredVisitors.map((v) => [
          fmtVisitDateTime(v.createdAt),
          v.visitorName,
          v.phone,
          v.carReg,
          v.visitorToName,
          v.status,
        ]),
      };
    }
    if (type === "assets") {
      return {
        headers: ["Date / time", "Action", "Asset", "Tag", "Holder", "Destination", "Condition", "Recorded by"],
        rows: filteredAssets.map((m) => [
          m.atText,
          m.action === "checkout" ? "Allocated" : "Returned",
          m.assetName,
          m.assetTag,
          m.holderName,
          m.destination ?? "",
          m.condition ?? "",
          m.recordedByName ?? "",
        ]),
      };
    }
    return {
      headers: ["Number", "Supplier", "Bill date", "Due date", "Amount (KES)", "Status"],
      rows: filteredBills.map((b) => [b.number, b.contact_name, b.bill_date, b.due_date, String(b.amount), b.status]),
    };
  }

  function exportCsv() {
    const { headers, rows } = currentRows();
    triggerDownload(`${type}-report.csv`, toCsv([headers, ...rows]), "text/csv;charset=utf-8");
    toast.success("CSV exported.");
  }

  function exportExcel() {
    const { headers, rows } = currentRows();
    const title = `${TYPE_LABELS[type]} report — ${scopeLabel} — ${rangeLabel}`;
    triggerDownload(`${type}-report.xls`, toExcelHtml(title, headers, rows), "application/vnd.ms-excel;charset=utf-8");
    toast.success("Excel file exported.");
  }

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Reports"
          subtitle="Pull printable reports for leave days, car logs, petty cash, invoices, bills, tasks and visitors across the whole office — or for one person."
        />
        {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      </div>

      <div className="no-print card mb-6 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="label" htmlFor="rp-type">Report type</label>
            <select id="rp-type" className="input" value={type} onChange={(e) => setType(e.target.value as ReportType)}>
              <option value="leave">Leave days</option>
              <option value="cars">Car logs</option>
              <option value="petty">Petty cash</option>
              <option value="invoices">Invoices</option>
              <option value="bills">Bills</option>
              <option value="tasks">Tasks</option>
              <option value="visitors">Visitors</option>
              <option value="assets">Asset movement</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="rp-from">From</label>
            <input id="rp-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="rp-to">To</label>
            <input id="rp-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="rp-employee">{type === "visitors" ? "Host" : "Employee"}</label>
            <select id="rp-employee" className="input" value={employee} onChange={(e) => setEmployee(e.target.value)}>
              <option value="">{type === "visitors" ? "All hosts" : "All employees"}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {(from || to || employee) && (
            <button className="btn-secondary" onClick={() => { setFrom(""); setTo(""); setEmployee(""); }}>
              Clear filters
            </button>
          )}
          <ShareButton url={shareUrl} title={`${TYPE_LABELS[type]} report`} text={`${TYPE_LABELS[type]} report — ${scopeLabel} — ${rangeLabel}`} className="btn-secondary px-3 py-1.5 text-sm" />
          <span className="inline-flex gap-2">
            <button onClick={exportCsv} className="btn-secondary px-3 py-1.5 text-sm">Export CSV</button>
            <button onClick={exportExcel} className="btn-secondary px-3 py-1.5 text-sm">Export Excel</button>
            <button className="btn-primary px-3 py-1.5 text-sm" onClick={() => printDocument("/reports")}>🖨 Print / Save as PDF</button>
          </span>
        </div>
      </div>

      {/* Printable block */}
      <div className="report-print card overflow-x-auto">
        <OrgHeader
          org={org}
          showTax
          periodLabel={`${TYPE_LABELS[type]} report — ${scopeLabel}`}
        />
        <div className="border-b border-slate-200 px-5 pb-4">
          <p className="text-sm text-slate-500">{rangeLabel} · Generated {generatedAt}</p>
        </div>

        {!data ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">Loading…</p>
        ) : type === "leave" ? (
          <ReportLeave rows={filteredLeaves} />
        ) : type === "cars" ? (
          <ReportCars rows={filteredCars} />
        ) : type === "petty" ? (
          <ReportPetty rows={filteredPetty} />
        ) : type === "invoices" ? (
          <ReportInvoices rows={filteredInvoices} />
        ) : type === "tasks" ? (
          <ReportTasks rows={filteredTasks} />
        ) : type === "visitors" ? (
          <ReportVisitors rows={filteredVisitors} />
        ) : type === "assets" ? (
          <ReportAssets rows={filteredAssets} />
        ) : (
          <ReportBills rows={filteredBills} />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm">
          {type === "leave" ? (
            <p className="font-semibold text-slate-700">
              Totals: <span className="text-blue-700">{leaveDays} day(s)</span> across {filteredLeaves.length} leave request(s)
            </p>
          ) : type === "cars" ? (
            <p className="font-semibold text-slate-700">
              Totals: <span className="text-emerald-700">{fmtKsh(carTotal)}</span> across {filteredCars.length} car log(s)
            </p>
          ) : type === "petty" ? (
            <p className="font-semibold text-slate-700">
              Totals: <span className="text-orange-700">{fmtKsh(pettyTotal)}</span> across {filteredPetty.length} request(s)
            </p>
          ) : type === "invoices" ? (
            <p className="font-semibold text-slate-700">
              Totals: <span className="text-sky-700">{fmtKsh(invoiceTotal)}</span> across {filteredInvoices.length} invoice(s)
            </p>
          ) : type === "tasks" ? (
            <p className="font-semibold text-slate-700">
              Totals: <span className="text-indigo-700">{filteredTasks.length}</span> task(s)
            </p>
          ) : type === "visitors" ? (
            <p className="font-semibold text-slate-700">
              Totals: <span className="text-teal-700">{filteredVisitors.length}</span> visitor(s)
            </p>
          ) : type === "assets" ? (
            <p className="font-semibold text-slate-700">
              Totals: <span className="text-orange-700">{filteredAssets.filter((m) => m.action === "checkout").length}</span> allocation(s) · {filteredAssets.length} movement(s)
            </p>
          ) : (
            <p className="font-semibold text-slate-700">
              Totals: <span className="text-violet-700">{fmtKsh(billTotal)}</span> across {filteredBills.length} bill(s)
            </p>
          )}
        </div>
        <OrgFooter org={org} text="This is a computer-generated report." />
      </div>
    </>
  );
}

function ReportLeave({ rows }: { rows: LeaveRow[] }) {
  return (
    <table className="table-base">
      <thead>
        <tr>
          <th>Employee</th>
          <th>Type</th>
          <th className="text-right">Days</th>
          <th>From</th>
          <th>To</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((l) => (
          <tr key={l.id}>
            <td className="font-medium">{l.requester_name ?? "—"}</td>
            <td className="capitalize">{l.leave_type}</td>
            <td className="text-right">{l.days}</td>
            <td>{l.start_date}</td>
            <td>{l.end_date}</td>
            <td><StatusBadge status={l.status} /></td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={6} className="py-8 text-center text-slate-400">No leave requests match the selected filters.</td></tr>
        )}
      </tbody>
    </table>
  );
}

function ReportCars({ rows }: { rows: CarLogRow[] }) {
  return (
    <table className="table-base">
      <thead>
        <tr>
          <th>Employee</th>
          <th>Vehicle</th>
          <th>Category</th>
          <th>Description</th>
          <th>Vendor</th>
          <th className="text-right">Amount</th>
          <th>Log date</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.id}>
            <td className="font-medium">{c.requester_name ?? "—"}</td>
            <td>{c.vehicle_reg}</td>
            <td className="capitalize">{c.category}</td>
            <td className="max-w-48 truncate">{c.description}</td>
            <td>{c.vendor ?? "—"}</td>
            <td className="text-right">{fmtKsh(c.amount)}</td>
            <td>{c.log_date}</td>
            <td><StatusBadge status={c.status} /></td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={8} className="py-8 text-center text-slate-400">No car logs match the selected filters.</td></tr>
        )}
      </tbody>
    </table>
  );
}

function ReportPetty({ rows }: { rows: PettyCashRow[] }) {
  return (
    <table className="table-base">
      <thead>
        <tr>
          <th>Employee</th>
          <th>Requisition</th>
          <th className="text-right">Amount</th>
          <th>Purpose</th>
          <th>Date needed</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.id}>
            <td className="font-medium">{p.requester_name ?? "—"}</td>
            <td>{p.requisition_no ?? "—"}</td>
            <td className="text-right">{fmtKsh(p.amount)}</td>
            <td className="max-w-64 truncate">{p.purpose}</td>
            <td>{p.date_needed}</td>
            <td><StatusBadge status={p.status} /></td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={6} className="py-8 text-center text-slate-400">No petty cash requests match the selected filters.</td></tr>
        )}
      </tbody>
    </table>
  );
}

function ReportInvoices({ rows }: { rows: InvoiceRow[] }) {
  return (
    <table className="table-base">
      <thead>
        <tr>
          <th>Number</th>
          <th>Customer</th>
          <th>Issue date</th>
          <th>Due date</th>
          <th className="text-right">Total</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((inv) => (
          <tr key={inv.id}>
            <td className="font-medium">{inv.number}</td>
            <td>{inv.contact_name}</td>
            <td>{inv.issue_date}</td>
            <td>{inv.due_date}</td>
            <td className="text-right">{fmtKsh(inv.total)}</td>
            <td><StatusBadge status={inv.status} /></td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={6} className="py-8 text-center text-slate-400">No invoices match the selected filters.</td></tr>
        )}
      </tbody>
    </table>
  );
}

function ReportBills({ rows }: { rows: BillRow[] }) {
  return (
    <table className="table-base">
      <thead>
        <tr>
          <th>Number</th>
          <th>Supplier</th>
          <th>Bill date</th>
          <th>Due date</th>
          <th className="text-right">Amount</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((b) => (
          <tr key={b.id}>
            <td className="font-medium">{b.number}</td>
            <td>{b.contact_name}</td>
            <td>{b.bill_date}</td>
            <td>{b.due_date}</td>
            <td className="text-right">{fmtKsh(b.amount)}</td>
            <td><StatusBadge status={b.status} /></td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={6} className="py-8 text-center text-slate-400">No bills match the selected filters.</td></tr>
        )}
      </tbody>
    </table>
  );
}

function ReportTasks({ rows }: { rows: TaskReportRow[] }) {
  return (
    <table className="table-base">
      <thead>
        <tr>
          <th>Task</th>
          <th>Assignee</th>
          <th>Priority</th>
          <th>Due date</th>
          <th>Status</th>
          <th className="text-right">Reports</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => (
          <tr key={t.id}>
            <td className="font-medium">
              {t.title}
              <div className="text-xs text-slate-400">by {t.created_by_name}</div>
            </td>
            <td>{t.assignee_name}</td>
            <td className="capitalize">{t.priority}</td>
            <td>{t.due_date ?? "—"}</td>
            <td><StatusBadge status={t.status} /></td>
            <td className="text-right">{t.report_count}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={6} className="py-8 text-center text-slate-400">No tasks match the selected filters.</td></tr>
        )}
      </tbody>
    </table>
  );
}

function ReportVisitors({ rows }: { rows: VisitorReportRow[] }) {
  return (
    <table className="table-base">
      <thead>
        <tr>
          <th>Date / time</th>
          <th>Visitor</th>
          <th>Phone</th>
          <th>Car registration</th>
          <th>Host</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((v) => (
          <tr key={v.id}>
            <td>{fmtVisitDateTime(v.createdAt)}</td>
            <td className="font-medium">{v.visitorName}</td>
            <td>{v.phone}</td>
            <td>{v.carReg || "—"}</td>
            <td>{v.visitorToName}</td>
            <td><StatusBadge status={v.status} /></td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={6} className="py-8 text-center text-slate-400">No visitors match the selected filters.</td></tr>
        )}
      </tbody>
    </table>
  );
}

function ReportAssets({ rows }: { rows: AssetMovementRow[] }) {
  return (
    <table className="table-base">
      <thead>
        <tr>
          <th>Date / time</th>
          <th>Action</th>
          <th>Asset</th>
          <th>Holder</th>
          <th>Destination</th>
          <th>Condition</th>
          <th>Recorded by</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.id}>
            <td className="whitespace-nowrap">{m.atText}</td>
            <td>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m.action === "checkout" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                {m.action === "checkout" ? "Allocated" : "Returned"}
              </span>
            </td>
            <td className="font-medium">{m.assetName} <span className="text-xs text-slate-400">{m.assetTag}</span></td>
            <td>{m.holderName}</td>
            <td>{m.destination ?? "—"}</td>
            <td>{m.condition ?? "—"}</td>
            <td>{m.recordedByName ?? "—"}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={7} className="py-8 text-center text-slate-400">No asset movements match the selected filters.</td></tr>
        )}
      </tbody>
    </table>
  );
}

export default function Reports() {
  return (
    <Suspense fallback={null}>
      <ReportsPage />
    </Suspense>
  );
}