"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { PageHeader, Alert, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useSession } from "@/components/SessionProvider";
import type { Role } from "@/lib/types";

interface VisitorRow {
  id: string;
  visitorName: string;
  phone: string;
  carReg: string | null;
  visitorTo: string;
  visitorToName: string;
  status: "pending" | "seen" | "completed";
  createdAt: number;
}

interface StaffOption {
  id: string;
  name: string;
  role: Role;
}

const STATUS_TONE: Record<VisitorRow["status"], string> = {
  pending: "bg-amber-50 text-amber-700",
  seen: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
};

function fmtDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-KE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VisitorsPage() {
  const session = useSession();
  const toast = useToast();
  const isReception = session?.role === "admin" || session?.role === "secretary";
  const isAdmin = session?.role === "admin";

  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [visitorName, setVisitorName] = useState("");
  const [phone, setPhone] = useState("");
  const [carReg, setCarReg] = useState("");
  const [visitorTo, setVisitorTo] = useState("");
  const [saving, setSaving] = useState(false);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  async function load(f = from, t = to) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (f) params.set("from", String(new Date(f + "T00:00:00").getTime()));
      if (t) params.set("to", String(new Date(t + "T23:59:59").getTime()));
      const qs = params.toString();
      const data = await api<{ visitors: VisitorRow[] }>(`/api/visitors${qs ? `?${qs}` : ""}`);
      setVisitors(data.visitors);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isReception) return;
    api<{ users: StaffOption[] }>("/api/users")
      .then((d) => setStaff(d.users))
      .catch(() => undefined);
  }, [isReception]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return visitors;
    return visitors.filter((v) =>
      [v.visitorName, v.phone, v.carReg, v.visitorToName]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [visitors, q]);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const today = visitors.filter((v) => v.createdAt >= startOfToday).length;
    return {
      total: visitors.length,
      today,
      pending: visitors.filter((v) => v.status === "pending").length,
    };
  }, [visitors]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!visitorTo) {
      toast.error("Choose who the visitor is coming to see");
      return;
    }
    setSaving(true);
    try {
      await api("/api/visitors", {
        method: "POST",
        json: { visitorName, phone, carReg, visitorTo },
      });
      toast.success("Visitor registered");
      setVisitorName("");
      setPhone("");
      setCarReg("");
      setVisitorTo("");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: VisitorRow["status"]) {
    try {
      await api(`/api/visitors/${id}`, { method: "PATCH", json: { status } });
      setVisitors((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)));
      toast.success(`Marked ${status}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this visitor record?")) return;
    try {
      await api(`/api/visitors/${id}`, { method: "DELETE" });
      setVisitors((prev) => prev.filter((v) => v.id !== id));
      toast.success("Visitor record deleted");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function exportCsv() {
    const rows: string[][] = [
      ["Date/Time", "Visitor", "Phone", "Car Registration", "Host", "Status"],
      ...filtered.map((v) => [
        fmtDateTime(v.createdAt),
        v.visitorName,
        v.phone,
        v.carReg ?? "",
        v.visitorToName,
        v.status,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visitors-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Visitors Book"
        subtitle={
          isReception
            ? "Register everyone who comes in, and keep a searchable record for reporting."
            : "Visitors who have come to see you."
        }
        action={
          isReception ? (
            <button onClick={exportCsv} className="btn-secondary" disabled={filtered.length === 0}>
              Export CSV
            </button>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      {isReception && (
        <form onSubmit={submit} className="card mb-6 p-5">
          <h3 className="mb-4 text-sm font-bold text-slate-800">Register a visitor</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Visitor name</span>
              <input
                className="input"
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                placeholder="Full name"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Phone number</span>
              <input
                className="input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XX XXX XXX"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Car registration (optional)</span>
              <input
                className="input"
                value={carReg}
                onChange={(e) => setCarReg(e.target.value)}
                placeholder="e.g. KDA 123A"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Coming to see</span>
              <select
                className="input"
                value={visitorTo}
                onChange={(e) => setVisitorTo(e.target.value)}
                required
              >
                <option value="">Select a person…</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Register visitor"}
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">In this view</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-800">{stats.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Today</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-800">{stats.today}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Still pending</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-600">{stats.pending}</p>
        </div>
      </div>

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">From</span>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">To</span>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="button" className="btn-secondary" onClick={() => load()}>
          Apply
        </button>
        <label className="ml-auto block min-w-[12rem] flex-1">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Search</span>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, phone, car, host…"
          />
        </label>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">
            {isReception ? "No visitors recorded yet." : "No visitors have come to see you yet."}
          </p>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-semibold">Date / time</th>
                <th className="px-5 py-3 font-semibold">Visitor</th>
                <th className="px-5 py-3 font-semibold">Phone</th>
                <th className="px-5 py-3 font-semibold">Car reg.</th>
                <th className="px-5 py-3 font-semibold">Host</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                {isReception && <th className="px-5 py-3 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((v) => (
                <tr key={v.id} className="transition hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">{fmtDateTime(v.createdAt)}</td>
                  <td className="px-5 py-3 font-semibold text-slate-800">{v.visitorName}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-600">{v.phone}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-600">{v.carReg || "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{v.visitorToName}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${STATUS_TONE[v.status]}`}>
                      {v.status}
                    </span>
                  </td>
                  {isReception && (
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        {v.status === "pending" && (
                          <button className="btn-secondary px-3 py-1.5" onClick={() => setStatus(v.id, "seen")}>
                            Mark seen
                          </button>
                        )}
                        {v.status !== "completed" && (
                          <button className="btn-success px-3 py-1.5" onClick={() => setStatus(v.id, "completed")}>
                            Done
                          </button>
                        )}
                        {isAdmin && (
                          <button className="btn-danger px-3 py-1.5" onClick={() => remove(v.id)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
