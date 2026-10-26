"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { PageHeader, Alert, Modal, StatusBadge, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePermissions } from "@/components/usePermissions";

interface Pipeline { _id: string; name: string; isDefault: boolean; active: boolean; }
interface Stage { _id: string; pipelineId: string; name: string; order: number; isWon: boolean; isLost: boolean; }
interface Deal {
  _id: string;
  pipelineId: string;
  stageId: string;
  companyId?: string;
  contactId?: string;
  title: string;
  value: number;
  currency: string;
  expectedCloseDate?: string;
  status: "open" | "won" | "lost";
  notes?: string;
}
interface Company { _id: string; name: string; }
interface Contact { _id: string; name: string; companyId?: string; }

const EMPTY = { title: "", value: "", stageId: "", companyId: "", contactId: "", expectedCloseDate: "", notes: "" };

function fmt(n: number, currency = "KES") {
  return `${currency} ${Math.round(n).toLocaleString("en-KE")}`;
}

export default function DealsPage() {
  const toast = useToast();
  const { modules, can } = usePermissions();

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [activeId, setActiveId] = useState("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [openOnly, setOpenOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [formStatus, setFormStatus] = useState<"open" | "won" | "lost">("open");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const pl = await api<{ pipelines: Pipeline[] }>("/api/crm/pipelines");
        setPipelines(pl.pipelines);
        const id = pl.pipelines.find((p) => p.isDefault)?._id ?? pl.pipelines[0]?._id ?? "";
        setActiveId(id);
        const [co, ct] = await Promise.all([
          api<{ companies: Company[] }>("/api/crm/companies").catch(() => ({ companies: [] as Company[] })),
          api<{ contacts: Contact[] }>("/api/crm/contacts").catch(() => ({ contacts: [] as Contact[] })),
        ]);
        setCompanies(co.companies);
        setContacts(ct.contacts);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load deals");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadBoard = useCallback(async () => {
    if (!activeId) {
      setStages([]);
      setDeals([]);
      return;
    }
    try {
      const [st, dl] = await Promise.all([
        api<{ stages: Stage[] }>(`/api/crm/pipelines/${activeId}/stages`),
        api<{ deals: Deal[] }>(`/api/crm/deals?pipelineId=${activeId}`),
      ]);
      setStages(st.stages);
      setDeals(dl.deals);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load deals");
    }
  }, [activeId]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard, version]);

  const active = pipelines.find((p) => p._id === activeId) ?? null;
  const companyName = (id?: string) => companies.find((c) => c._id === id)?.name;
  const contactName = (id?: string) => contacts.find((c) => c._id === id)?.name;

  const visibleDeals = deals.filter((d) => (openOnly ? d.status === "open" : true));
  const byStage = new Map<string, Deal[]>();
  for (const d of visibleDeals) {
    if (!byStage.has(d.stageId)) byStage.set(d.stageId, []);
    byStage.get(d.stageId)!.push(d);
  }

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY, stageId: stages[0]?._id ?? "" });
    setFormStatus("open");
    setFormError(null);
    setOpen(true);
  }
  function openEdit(d: Deal) {
    setEditing(d);
    setForm({
      title: d.title,
      value: String(d.value),
      stageId: d.stageId,
      companyId: d.companyId ?? "",
      contactId: d.contactId ?? "",
      expectedCloseDate: d.expectedCloseDate ?? "",
      notes: d.notes ?? "",
    });
    setFormStatus(d.status);
    setFormError(null);
    setOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError("Deal title is required");
      return;
    }
    if (!form.stageId) {
      setFormError("Add a stage to the pipeline first");
      return;
    }
    const value = form.value === "" ? 0 : Number(form.value);
    setBusy(true);
    setFormError(null);
    try {
      if (editing) {
        await api(`/api/crm/deals/${editing._id}`, {
          method: "PATCH",
          json: {
            title: form.title,
            value,
            stageId: form.stageId,
            companyId: form.companyId || null,
            contactId: form.contactId || null,
            expectedCloseDate: form.expectedCloseDate || null,
            notes: form.notes,
            status: formStatus,
          },
        });
        toast.success("Deal saved");
      } else {
        await api("/api/crm/deals", {
          method: "POST",
          json: {
            pipelineId: activeId,
            stageId: form.stageId,
            title: form.title,
            value,
            companyId: form.companyId || undefined,
            contactId: form.contactId || undefined,
            expectedCloseDate: form.expectedCloseDate || undefined,
            notes: form.notes || undefined,
          },
        });
        toast.success("Deal created");
      }
      setOpen(false);
      setVersion((v) => v + 1);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save deal");
    } finally {
      setBusy(false);
    }
  }

  async function moveDeal(d: Deal, stageId: string) {
    if (stageId === d.stageId) return;
    try {
      await api(`/api/crm/deals/${d._id}`, { method: "PATCH", json: { stageId } });
      setVersion((v) => v + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to move deal");
    }
  }

  async function setStatus(d: Deal, status: "open" | "won" | "lost") {
    try {
      await api(`/api/crm/deals/${d._id}`, { method: "PATCH", json: { status } });
      toast.success(`Deal marked ${status}`);
      setVersion((v) => v + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update deal");
    }
  }

  async function remove(d: Deal) {
    if (!confirm(`Delete deal "${d.title}"?`)) return;
    try {
      await api(`/api/crm/deals/${d._id}`, { method: "DELETE" });
      toast.success("Deal deleted");
      setOpen(false);
      setVersion((v) => v + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete deal");
    }
  }

  if (Array.isArray(modules) && !can("crm-pipeline")) {
    return (
      <>
        <PageHeader title="Deals" />
        <Alert kind="error">You do not have access to CRM deals.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Deals"
        subtitle="Your sales board — deals grouped by pipeline stage."
        action={<button className="btn-primary" onClick={openNew} disabled={!activeId || stages.length === 0}>+ New deal</button>}
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      {loading && <p className="text-sm text-slate-500">Loading deals…</p>}

      {!loading && pipelines.length === 0 && (
        <div className="card p-6">
          <p className="text-sm text-slate-600">
            No pipelines yet. Create one on the{" "}
            <Link href="/crm/pipeline" className="font-semibold text-indigo-600 hover:underline">Pipeline</Link> page first.
          </p>
        </div>
      )}

      {pipelines.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {pipelines.map((p) => (
              <button
                key={p._id}
                onClick={() => setActiveId(p._id)}
                className={
                  p._id === activeId
                    ? "rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white"
                    : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                }
              >
                {p.name}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" className="h-4 w-4" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
              Open only
            </label>
          </div>

          {active && stages.length === 0 && (
            <div className="card p-6">
              <p className="text-sm text-slate-600">
                This pipeline has no stages. Add stages on the{" "}
                <Link href="/crm/pipeline" className="font-semibold text-indigo-600 hover:underline">Pipeline</Link> page.
              </p>
            </div>
          )}

          {stages.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-3">
              {stages.map((s) => {
                const items = byStage.get(s._id) ?? [];
                const total = items.reduce((sum, d) => sum + d.value, 0);
                return (
                  <div key={s._id} className="min-w-[240px] flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">{s.name}</p>
                      <span className="text-[11px] font-medium text-slate-400">{items.length}</span>
                    </div>
                    {items.length > 0 && <p className="mb-2 text-[11px] text-slate-400">{fmt(total)}</p>}
                    <div className="space-y-2">
                      {items.map((d) => (
                        <div key={d._id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-800">{d.title}</p>
                            {d.status !== "open" && <StatusBadge status={d.status} />}
                          </div>
                          <p className="mt-1 text-xs font-medium text-slate-600">{fmt(d.value, d.currency)}</p>
                          {companyName(d.companyId) && <p className="text-xs text-slate-400">{companyName(d.companyId)}</p>}
                          {contactName(d.contactId) && <p className="text-xs text-slate-400">{contactName(d.contactId)}</p>}
                          <div className="mt-2 flex items-center gap-1.5">
                            <select
                              className="input flex-1 py-1 text-xs"
                              value={d.stageId}
                              onChange={(e) => moveDeal(d, e.target.value)}
                              aria-label="Move deal to stage"
                            >
                              {stages.map((st) => <option key={st._id} value={st._id}>{st.name}</option>)}
                            </select>
                            <button className="btn-secondary px-2 py-1 text-xs" onClick={() => openEdit(d)}>Edit</button>
                          </div>
                        </div>
                      ))}
                      {items.length === 0 && <p className="text-xs text-slate-400">No deals.</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {open && (
        <Modal title={editing ? "Edit deal" : "New deal"} onClose={() => setOpen(false)}>
          <form onSubmit={save} className="space-y-3">
            {formError && <Alert kind="error">{formError}</Alert>}
            <div><label className="label">Deal title</label><input className="input" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required autoFocus /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Value</label><input className="input" type="number" min={0} value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} /></div>
              <div>
                <label className="label">Stage</label>
                <select className="input" value={form.stageId} onChange={(e) => setForm((p) => ({ ...p, stageId: e.target.value }))} required>
                  <option value="">— select —</option>
                  {stages.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Company</label>
                <select className="input" value={form.companyId} onChange={(e) => setForm((p) => ({ ...p, companyId: e.target.value }))}>
                  <option value="">— none —</option>
                  {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Contact</label>
                <select className="input" value={form.contactId} onChange={(e) => setForm((p) => ({ ...p, contactId: e.target.value }))}>
                  <option value="">— none —</option>
                  {contacts.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Expected close</label><input className="input" type="date" value={form.expectedCloseDate} onChange={(e) => setForm((p) => ({ ...p, expectedCloseDate: e.target.value }))} /></div>
              {editing && (
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={formStatus} onChange={(e) => setFormStatus(e.target.value as "open" | "won" | "lost")}>
                    <option value="open">Open</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
              )}
            </div>
            <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex items-center justify-between gap-2 pt-1">
              {editing ? (
                <button type="button" className="btn-danger px-3 py-2 text-sm" onClick={() => remove(editing)}>Delete</button>
              ) : <span />}
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create deal"}</button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
