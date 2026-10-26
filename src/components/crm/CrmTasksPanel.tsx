"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import { Alert, api } from "@/components/ui";
import { useToast } from "@/components/toast";

interface Task {
  _id: string;
  title: string;
  description?: string;
  dueAt?: number;
  status: "open" | "done" | "cancelled";
  priority?: "low" | "normal" | "high" | "urgent";
}

interface Scope {
  companyId?: string;
  contactId?: string;
  leadId?: string;
  dealId?: string;
}

function fmtDue(ms?: number) {
  if (!ms) return null;
  return new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CrmTasksPanel({
  scope,
  title = "Follow-up tasks",
  defaultPriority = "normal",
}: {
  scope: Scope;
  title?: string;
  defaultPriority?: "low" | "normal" | "high" | "urgent";
}) {
  const toast = useToast();
  const [rows, setRows] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState(defaultPriority);
  const [busy, setBusy] = useState(false);

  const query = (() => {
    const p = new URLSearchParams();
    if (scope.companyId) p.set("companyId", scope.companyId);
    if (scope.contactId) p.set("contactId", scope.contactId);
    if (scope.leadId) p.set("leadId", scope.leadId);
    if (scope.dealId) p.set("dealId", scope.dealId);
    return p.toString();
  })();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ tasks: Task[] }>(`/api/crm/tasks?${query}`);
      setRows(data.tasks);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      await api("/api/crm/tasks", {
        method: "POST",
        json: {
          title: newTitle,
          priority,
          dueAt: due ? new Date(`${due}T00:00:00`).getTime() : undefined,
          ...scope,
        },
      });
      setNewTitle("");
      setDue("");
      setPriority(defaultPriority);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add task");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(t: Task) {
    try {
      await api(`/api/crm/tasks/${t._id}`, {
        method: "PATCH",
        json: { status: t.status === "done" ? "open" : "done" },
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update task");
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/crm/tasks/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete task");
    }
  }

  return (
    <div className="card p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-600">{title}</h2>
      {error && <div className="mb-3"><Alert kind="error">{error}</Alert></div>}

      <form onSubmit={add} className="mb-3 flex flex-wrap items-end gap-2">
        <input className="input min-w-[12rem] flex-1" placeholder="New task…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
        <input className="input w-36" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <select className="input w-32" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <button type="submit" className="btn-secondary px-3 py-2 text-sm" disabled={busy}>Add</button>
      </form>

      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-slate-500">No tasks.</p>}

      <ul className="space-y-2">
        {rows.map((t) => (
          <li key={t._id} className="flex items-start gap-2 rounded-lg border border-slate-100 px-3 py-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={t.status === "done"} onChange={() => toggle(t)} />
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${t.status === "done" ? "text-slate-400 line-through" : "text-slate-700"}`}>{t.title}</p>
              <p className="text-[11px] text-slate-400">
                {fmtDue(t.dueAt) ? `Due ${fmtDue(t.dueAt)} · ` : ""}
                <span className={t.priority === "urgent" || t.priority === "high" ? "font-semibold text-amber-600" : ""}>
                  {(t.priority ?? "normal")}
                </span>
              </p>
            </div>
            <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => remove(t._id)} aria-label="Delete task">×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
