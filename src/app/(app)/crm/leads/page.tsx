"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import { PageHeader, Alert, Modal, StatusBadge, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePermissions } from "@/components/usePermissions";

interface Lead {
  _id: string;
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  source?: string;
  status: "new" | "contacted" | "qualified" | "disqualified" | "converted";
  value?: number;
  notes?: string;
  aiScore?: number;
  aiConfidence?: number;
  aiSummary?: string;
  aiIntent?: string;
  aiNextAction?: string;
  aiUpdatedAt?: number;
}

const EMPTY = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  source: "",
  value: "",
  notes: "",
};

const EDITABLE_STATUSES = ["new", "contacted", "qualified", "disqualified"] as const;

function aiTone(score?: number): string {
  if (score == null) return "bg-slate-100 text-slate-600";
  if (score >= 70) return "bg-emerald-50 text-emerald-700";
  if (score >= 45) return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

export default function LeadsPage() {
  const toast = useToast();
  const { modules, can } = usePermissions();

  const [rows, setRows] = useState<Lead[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [formStatus, setFormStatus] = useState<string>("new");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [scoringId, setScoringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      const data = await api<{ leads: Lead[] }>(`/api/crm/leads?${params.toString()}`);
      setRows(data.leads);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setFormStatus("new");
    setFormError(null);
    setOpen(true);
  }
  function openEdit(l: Lead) {
    setEditing(l);
    setForm({
      companyName: l.companyName ?? "",
      contactName: l.contactName ?? "",
      email: l.email ?? "",
      phone: l.phone ?? "",
      source: l.source ?? "",
      value: l.value != null ? String(l.value) : "",
      notes: l.notes ?? "",
    });
    setFormStatus(l.status === "converted" ? "qualified" : l.status);
    setFormError(null);
    setOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.companyName.trim() && !form.contactName.trim() && !form.email.trim()) {
      setFormError("Enter at least a company name, contact name or email");
      return;
    }
    setBusy(true);
    setFormError(null);
    const payload = {
      companyName: form.companyName || undefined,
      contactName: form.contactName || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      source: form.source || undefined,
      value: form.value === "" ? undefined : Number(form.value),
      notes: form.notes || undefined,
    };
    try {
      if (editing) {
        await api(`/api/crm/leads/${editing._id}`, {
          method: "PATCH",
          json: { ...payload, status: formStatus },
        });
        toast.success("Lead saved");
      } else {
        await api("/api/crm/leads", { method: "POST", json: payload });
        toast.success("Lead added");
      }
      setOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save lead");
    } finally {
      setBusy(false);
    }
  }

  async function convert(l: Lead) {
    if (!confirm(`Convert ${l.companyName ?? l.contactName ?? l.email} into a deal?`)) return;
    try {
      await api(`/api/crm/leads/${l._id}/convert`, { method: "POST" });
      toast.success("Lead converted. An open deal was created in your default pipeline.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to convert lead");
    }
  }

  async function remove(l: Lead) {
    if (!confirm(`Delete lead ${l.companyName ?? l.contactName ?? l.email}?`)) return;
    try {
      await api(`/api/crm/leads/${l._id}`, { method: "DELETE" });
      toast.success("Lead deleted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete lead");
    }
  }

  async function reviewInbox() {
    setAiBusy(true);
    try {
      const result = await api<{ reviewed: number; created: number; linked: number }>(
        "/api/crm/ai/leads/review",
        { method: "POST", json: { limit: 8 } }
      );
      toast.success(
        `AI reviewed ${result.reviewed} email(s): ${result.created} new lead(s), ${result.linked} linked.`
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI review failed");
    } finally {
      setAiBusy(false);
    }
  }

  async function scoreUnscored() {
    setAiBusy(true);
    try {
      const result = await api<{ scored: number }>("/api/crm/ai/leads/score", {
        method: "POST",
        json: { limit: 5 },
      });
      toast.success(`AI scored ${result.scored} lead(s).`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI scoring failed");
    } finally {
      setAiBusy(false);
    }
  }

  async function scoreLead(l: Lead) {
    setScoringId(l._id);
    try {
      const result = await api<{
        score: number;
        confidence: number;
        summary: string;
        intent: string;
        nextAction: string;
      }>(`/api/crm/ai/leads/${l._id}/score`, { method: "POST" });
      setEditing((prev) =>
        prev && prev._id === l._id
          ? {
              ...prev,
              aiScore: result.score,
              aiConfidence: result.confidence,
              aiSummary: result.summary,
              aiIntent: result.intent,
              aiNextAction: result.nextAction,
            }
          : prev
      );
      toast.success(`AI score: ${result.score}/100`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI scoring failed");
    } finally {
      setScoringId(null);
    }
  }
  if (Array.isArray(modules) && !can("crm-leads")) {
    return (
      <>
        <PageHeader title="Leads" />
        <Alert kind="error">You do not have access to CRM leads.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Inbound prospects. Qualify them, then convert to a company, contact and deal."
        action={<button className="btn-primary" onClick={openNew}>+ New lead</button>}
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className="input w-full sm:w-64"
          placeholder="Search company, contact or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="disqualified">Disqualified</option>
          <option value="converted">Converted</option>
        </select>
        <span className="text-xs text-slate-500">{rows.length} lead(s)</span>
        {can("crm-email") && (
          <button type="button" className="btn-secondary" onClick={reviewInbox} disabled={aiBusy}>
            {aiBusy ? "Reviewing..." : "AI review inbox"}
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={scoreUnscored} disabled={aiBusy}>
          {aiBusy ? "Scoring..." : "Score unrated"}
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Company</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Source</th>
              <th className="text-right">Value</th>
              <th>AI</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="py-8 text-center text-slate-500">Loading leads…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="py-8 text-center text-slate-500">No leads yet.</td></tr>
            )}
            {!loading && rows.map((l) => (
              <tr key={l._id}>
                <td className="font-medium">{l.companyName || "—"}</td>
                <td>{l.contactName || "—"}</td>
                <td>{l.email || "—"}</td>
                <td>{l.phone || "—"}</td>
                <td>{l.source || "—"}</td>
                <td className="text-right">{l.value != null ? l.value.toLocaleString() : "—"}</td>
                <td>
                  {l.aiScore != null ? (
                    <div className="flex max-w-[17rem] flex-col gap-0.5">
                      <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${aiTone(l.aiScore)}`}>
                        {l.aiScore}/100
                      </span>
                      {l.aiNextAction && (
                        <span
                          className="truncate text-[11px] text-slate-500"
                          title={[l.aiSummary, l.aiIntent, l.aiNextAction].filter(Boolean).join("\n")}
                        >
                          {l.aiNextAction}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400">&mdash;</span>
                  )}
                </td>
                <td><StatusBadge status={l.status} /></td>
                <td className="space-x-1.5 whitespace-nowrap text-right">
                  <button
                    className="btn-secondary px-2 py-1 text-xs"
                    onClick={() => scoreLead(l)}
                    disabled={scoringId === l._id}
                  >
                    {scoringId === l._id ? "Scoring..." : "AI"}
                  </button>
                  {l.status !== "converted" && l.status !== "disqualified" && (
                    <button className="btn-success px-2 py-1 text-xs" onClick={() => convert(l)}>Convert</button>
                  )}
                  <button className="btn-secondary px-2 py-1 text-xs" onClick={() => openEdit(l)}>Edit</button>
                  <button className="btn-danger px-2 py-1 text-xs" onClick={() => remove(l)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal title={editing ? "Edit lead" : "New lead"} onClose={() => setOpen(false)}>
          <form onSubmit={save} className="space-y-3">
            {formError && <Alert kind="error">{formError}</Alert>}
            {editing && (
              <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-slate-600">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">AI assessment</span>
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${aiTone(editing.aiScore)}`}>
                    {editing.aiScore != null ? `${editing.aiScore}/100` : "Not scored"}
                  </span>
                </div>
                {editing.aiSummary && <p className="mt-2 max-h-20 overflow-y-auto">{editing.aiSummary}</p>}
                {editing.aiIntent && <p className="mt-1"><strong>Intent:</strong> {editing.aiIntent}</p>}
                {editing.aiNextAction && <p className="mt-1"><strong>Next action:</strong> {editing.aiNextAction}</p>}
                <button
                  type="button"
                  className="btn-secondary mt-2 px-2 py-1 text-xs"
                  onClick={() => scoreLead(editing)}
                  disabled={scoringId === editing._id}
                >
                  {scoringId === editing._id ? "Scoring..." : "Score with AI"}
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Company</label><input className="input" value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} autoFocus /></div>
              <div><label className="label">Contact name</label><input className="input" value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></div>
              <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Source</label><input className="input" placeholder="website, referral…" value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))} /></div>
              <div><label className="label">Estimated value</label><input className="input" type="number" min={0} value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} /></div>
            </div>
            {editing && (
              <div>
                <label className="label">Status</label>
                <select className="input" value={formStatus} onChange={(e) => setFormStatus(e.target.value)}>
                  {EDITABLE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add lead"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
