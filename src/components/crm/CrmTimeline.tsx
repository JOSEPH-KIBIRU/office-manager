"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import { Alert, Modal, api } from "@/components/ui";
import { useToast } from "@/components/toast";

type EntityType = "company" | "contact" | "lead" | "deal" | "quotation";

interface Activity {
  _id: string;
  type: string;
  subject?: string;
  body?: string;
  occurredAt: number;
  actorId?: string;
}

const TYPES = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
];

function fmt(ms: number) {
  return new Date(ms).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function CrmTimeline({
  entityType,
  entityId,
  title = "Timeline",
}: {
  entityType: EntityType;
  entityId: string;
  title?: string;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ activities: Activity[] }>(
        `/api/crm/activities?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}&limit=100`
      );
      setRows(data.activities);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load timeline");
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim() && !body.trim()) {
      toast.error("Add a subject or details");
      return;
    }
    setBusy(true);
    try {
      await api("/api/crm/activities", {
        method: "POST",
        json: { entityType, entityId, type, subject: subject || undefined, body: body || undefined },
      });
      toast.success("Activity logged");
      setOpen(false);
      setSubject("");
      setBody("");
      setType("note");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to log activity");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/crm/activities/${id}`, { method: "DELETE" });
      toast.success("Activity removed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove activity");
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-600">{title}</h2>
        <button className="btn-secondary px-3 py-1.5 text-sm" onClick={() => setOpen(true)}>+ Log activity</button>
      </div>

      {error && <div className="mb-3"><Alert kind="error">{error}</Alert></div>}
      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-slate-500">No activity yet.</p>}

      <ol className="space-y-3">
        {rows.map((a) => (
          <li key={a._id} className="flex gap-3 border-l-2 border-slate-200 pl-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                  {a.type.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-slate-400">{fmt(a.occurredAt)}</span>
              </div>
              {a.subject && <p className="mt-1 text-sm font-medium text-slate-800">{a.subject}</p>}
              {a.body && <p className="text-sm text-slate-600 whitespace-pre-wrap">{a.body}</p>}
            </div>
            <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => remove(a._id)} aria-label="Delete activity">
              ×
            </button>
          </li>
        ))}
      </ol>

      {open && (
        <Modal title="Log activity" onClose={() => setOpen(false)}>
          <form onSubmit={add} className="space-y-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><label className="label">Subject</label><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus /></div>
            <div><label className="label">Details</label><textarea className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Log activity"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
