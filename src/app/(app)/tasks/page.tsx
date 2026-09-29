"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/SessionProvider";
import { PageHeader, Alert, Modal, FieldError, inputCls, api } from "@/components/ui";
import { useToast } from "@/components/toast";

interface TaskRow {
  id: string;
  title: string;
  description: string;
  priority: "low" | "normal" | "high" | "urgent";
  due_date: string | null;
  status: string;
  created_by: string;
  created_by_name: string;
  assignee_id: string;
  assignee_name: string;
  remark: string | null;
  report_count: number;
  comment_count: number;
  last_update_at: string;
  created_at: string;
}

interface UserLite {
  id: string;
  name: string;
  role: string;
}

const STATUS_BADGE: Record<string, string> = {
  open: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  submitted: "bg-amber-100 text-amber-800",
  acknowledged: "bg-emerald-100 text-emerald-700",
  reopened: "bg-orange-100 text-orange-700",
  cancelled: "bg-slate-200 text-slate-500",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  reopened: "Reopened",
  cancelled: "Cancelled",
};

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-slate-100 text-slate-500",
  normal: "bg-slate-100 text-slate-600",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

export default function TasksPage() {
  const session = useSession();
  const isAdmin = session?.role === "admin";
  const toast = useToast();

  const [scope, setScope] = useState<"assigned" | "created" | "all">("assigned");
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await api<{ tasks: TaskRow[] }>(`/api/tasks?scope=${scope}`);
      setTasks(data.tasks);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  async function openCreate() {
    setTitle("");
    setDescription("");
    setPriority("normal");
    setDueDate("");
    setAssigneeId("");
    setErrors({});
    setShowCreate(true);
    if (users.length === 0) {
      try {
        const data = await api<{ users: UserLite[] }>("/api/users?full=1");
        setUsers(data.users.filter((u) => u.role !== "super_admin"));
      } catch {
        /* ignore */
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string | undefined> = {};
    if (!title.trim()) errs.title = "Title is required";
    if (!assigneeId) errs.assigneeId = "Choose someone to assign this to";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setBusy(true);
    try {
      await api("/api/tasks", {
        method: "POST",
        json: { title, description, priority, dueDate: dueDate || undefined, assigneeId },
      });
      toast.success("Task assigned.");
      setShowCreate(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Tasks assigned down the line. Assignees submit a report with what they did, where they went and photos; the assigner acknowledges with a remark."
        action={isAdmin ? <button onClick={openCreate} className="btn-primary">+ Assign task</button> : undefined}
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="mb-5 flex flex-wrap gap-2">
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {([
            ["assigned", "Assigned to me"],
            ...(isAdmin ? [["created", "I assigned"], ["all", "All tasks"]] : []),
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setScope(id as typeof scope)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                scope === id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!tasks ? (
        <p className="card p-6 text-sm text-slate-400">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <p className="card p-6 text-sm text-slate-400">
          {scope === "assigned" ? "No tasks assigned to you." : "No tasks here yet."}
        </p>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <Link key={t.id} href={`/tasks/${t.id}`} className="card block p-4 transition hover:border-blue-200 hover:shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{t.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {scope === "assigned" ? `From ${t.created_by_name}` : `To ${t.assignee_name}`}
                    {t.due_date ? ` · due ${t.due_date}` : ""}
                    {t.report_count > 0 ? ` · ${t.report_count} report(s)` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className={`badge ${PRIORITY_BADGE[t.priority]}`}>{t.priority}</span>
                  <span className={`badge ${STATUS_BADGE[t.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="Assign a task" onClose={() => setShowCreate(false)}>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label" htmlFor="tk-title">Title</label>
              <input id="tk-title" className={inputCls(errors.title)} value={title} onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: undefined })); }} placeholder="e.g. Deliver documents to KRA" />
              <FieldError msg={errors.title} />
            </div>
            <div>
              <label className="label" htmlFor="tk-desc">Instructions / description</label>
              <textarea id="tk-desc" className={inputCls()} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What needs to be done…" />
            </div>
            <div>
              <label className="label" htmlFor="tk-assignee">Assign to</label>
              <select id="tk-assignee" className={inputCls(errors.assigneeId)} value={assigneeId} onChange={(e) => { setAssigneeId(e.target.value); setErrors((p) => ({ ...p, assigneeId: undefined })); }}>
                <option value="">Select a person…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
              <FieldError msg={errors.assigneeId} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="tk-priority">Priority</label>
                <select id="tk-priority" className={inputCls()} value={priority} onChange={(e) => setPriority(e.target.value)}>
                  {["low", "normal", "high", "urgent"].map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="tk-due">Due date (optional)</label>
                <input id="tk-due" type="date" className={inputCls()} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Assigning…" : "Assign task"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
