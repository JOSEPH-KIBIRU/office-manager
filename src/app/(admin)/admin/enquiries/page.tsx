"use client";

import { useEffect, useState } from "react";
import { Alert, PageHeader, ConfirmDialog, api } from "@/components/ui";
import { useToast } from "@/components/toast";

interface Enquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  subject: string | null;
  message: string;
  status: "new" | "contacted" | "closed";
  createdAt: number | string;
}

const FILTERS: ("all" | "new" | "contacted" | "closed")[] = ["all", "new", "contacted", "closed"];

const STATUS_STYLES: Record<string, string> = {
  new: "bg-amber-100 text-amber-800",
  contacted: "bg-blue-100 text-blue-800",
  closed: "bg-emerald-100 text-emerald-800",
};

function fmt(ts: number | string | null) {
  if (ts === null || ts === undefined || ts === "") return "—";
  const d = typeof ts === "number" || /^\d+$/.test(ts) ? new Date(typeof ts === "number" ? ts : Number(ts)) : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toISOString().replace("T", " ").slice(0, 16);
}

export default function EnquiriesPage() {
  const [items, setItems] = useState<Enquiry[]>([]);
  const [filter, setFilter] = useState<"all" | "new" | "contacted" | "closed">("all");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Enquiry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const toast = useToast();

  async function load() {
    try {
      const data = await api<{ enquiries: Enquiry[] }>("/api/admin/enquiries");
      setItems(data.enquiries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load enquiries");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(e: Enquiry, status: Enquiry["status"]) {
    setError(null);
    try {
      await api(`/api/admin/enquiries/${e.id}`, { method: "PATCH", json: { status } });
      toast.success(e.name + " marked as " + status + ".");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function remove() {
    const e = deleting;
    if (!e) return;
    setDeleteBusy(true);
    try {
      await api(`/api/admin/enquiries/${e.id}`, { method: "DELETE" });
      toast.success("Enquiry deleted.");
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  }

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);
  const counts = {
    all: items.length,
    new: items.filter((i) => i.status === "new").length,
    contacted: items.filter((i) => i.status === "contacted").length,
    closed: items.filter((i) => i.status === "closed").length,
  };

  return (
    <>
      <PageHeader
        title="Enquiries desk"
        subtitle="Messages submitted from the website contact form. New enquiries also alert you by SMS."
        action={
          <span className="badge bg-amber-100 text-amber-800">{counts.new} new</span>
        }
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn-secondary px-3 py-1.5 text-sm ${filter === f ? "bg-indigo-600 text-white" : ""}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card p-10 text-center text-slate-400">No enquiries yet.</div>
      )}

      <div className="space-y-4">
        {filtered.map((e) => (
          <div key={e.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-slate-900">{e.name}</h3>
                  {e.company && <span className="text-sm text-slate-500">· {e.company}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                  <a href={`mailto:${e.email}`} className="hover:text-blue-600">{e.email}</a>
                  <a href={`tel:${e.phone}`} className="hover:text-blue-600">{e.phone}</a>
                  <span className="text-slate-400">{fmt(e.createdAt)}</span>
                </div>
              </div>
              <span className={`badge ${STATUS_STYLES[e.status]}`}>{e.status}</span>
            </div>

            {e.subject && <p className="mt-3 text-sm font-semibold text-slate-800">{e.subject}</p>}
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{e.message}</p>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              {e.status !== "new" && (
                <button onClick={() => setStatus(e, "new")} className="btn-secondary btn-xs">Mark new</button>
              )}
              {e.status !== "contacted" && (
                <button onClick={() => setStatus(e, "contacted")} className="btn-secondary btn-xs text-blue-700">Mark contacted</button>
              )}
              {e.status !== "closed" && (
                <button onClick={() => setStatus(e, "closed")} className="btn-secondary btn-xs text-emerald-700">Mark closed</button>
              )}
              <button onClick={() => setDeleting(e)} className="btn-secondary ml-auto px-2 py-1 text-xs text-red-600">Delete</button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleting}
        title="Delete enquiry"
        message={<span>Delete the enquiry from <strong>{deleting?.name}</strong>? This cannot be undone.</span>}
        busy={deleteBusy}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
