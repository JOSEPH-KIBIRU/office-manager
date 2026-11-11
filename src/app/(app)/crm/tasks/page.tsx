"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import { PageHeader, Alert, Modal, StatusBadge, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePermissions } from "@/components/usePermissions";

interface Task {
  _id: string;
  title: string;
  description?: string;
  dueAt?: number;
  status: "open" | "done" | "cancelled";
  priority?: "low" | "normal" | "high" | "urgent";
  automationKey?: string;
}

const EMPTY = { title: "", description: "", due: "", priority: "normal" };

function fmtDue(ms?: number) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CrmTasksPage() {
  const toast = useToast();
  const { modules, can } = usePermissions();
  const [rows, setRows] = useState<Task[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = status ? `?status=${status}` : "";
      const data = await api<{ tasks: Task[] }>(`/api/crm/tasks${qs}`);
      setRows(data.tasks);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Task title is required");
      return;
    }
    setBusy(true);
    try {
      await api("/api/crm/tasks", {
        method: "POST",
        json: {
          title: form.title,
          description: form.description || undefined,
          priority: form.priority,
          dueAt: form.due ? new Date(`${form.due}T00:00:00`).getTime() : undefined,
        },
      });
      toast.success("Task added");
      setOpen(false);
      setForm(EMPTY);
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

  async function runAutomation() {
    setRunning(true);
    try {
      const result = await api<{ leads: number; deals: number; quotes: number }>(
        "/api/crm/automation/run",
        { method: "POST" }
      );
      toast.success(
        `Follow-up run complete: ${result.leads} lead, ${result.deals} deal, ${result.quotes} quote task(s).`
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Follow-up run failed");
    } finally {
      setRunning(false);
    }
  }
  async function remove(t: Task) {
    if (!confirm(`Delete task "${t.title}"?`)) return;
    try {
      await api(`/api/crm/tasks/${t._id}`, { method: "DELETE" });
      toast.success("Task deleted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete task");
    }
  }

  if (Array.isArray(modules) && !can("crm")) {
    return (
      <>
        <PageHeader title="Tasks" />
        <Alert kind="error">You do not have access to CRM tasks.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Follow-ups across your CRM."
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={runAutomation} disabled={running}>
              {running ? "Running..." : "Run follow-ups"}
            </button>
            <button className="btn-primary" onClick={() => setOpen(true)}>+ New task</button>
          </div>
        }
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span className="text-xs text-slate-500">{rows.length} task(s)</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr><th className="w-10"></th><th>Task</th><th>Due</th><th>Priority</th><th>Status</th><th className="text-right">Actions</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Loading tasks…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-slate-500">No tasks.</td></tr>
            )}
            {!loading && rows.map((t) => (
              <tr key={t._id}>
                <td><input type="checkbox" className="h-4 w-4" checked={t.status === "done"} onChange={() => toggle(t)} aria-label="Toggle task" /></td>
                <td className={t.status === "done" ? "text-slate-400 line-through" : "font-medium"}>
                  {t.title}
                  {t.automationKey && <span className="ml-1.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">auto</span>}
                </td>
                <td>{fmtDue(t.dueAt)}</td>
                <td className="capitalize">{t.priority ?? "normal"}</td>
                <td><StatusBadge status={t.status} /></td>
                <td className="text-right">
                  <button className="btn-danger px-2 py-1 text-xs" onClick={() => remove(t)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal title="New task" onClose={() => setOpen(false)}>
          <form onSubmit={create} className="space-y-3">
            <div><label className="label">Title</label><input className="input" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required autoFocus /></div>
            <div><label className="label">Details</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Due date</label><input className="input" type="date" value={form.due} onChange={(e) => setForm((p) => ({ ...p, due: e.target.value }))} /></div>
              <div>
                <label className="label">Priority</label>
                <select className="input" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Add task"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
