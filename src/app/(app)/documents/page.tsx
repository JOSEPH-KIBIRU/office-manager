"use client";

import { useEffect, useState, FormEvent } from "react";
import { PageHeader, Alert, Modal, ConfirmDialog, api } from "@/components/ui";
import { useToast } from "@/components/toast";

interface DocRow {
  id: string;
  userId: string | null;
  userName: string | null;
  title: string;
  category: "contract" | "license" | "insurance" | "certificate" | "other";
  issuedDate: string | null;
  expiryDate: string | null;
  fileName: string | null;
  fileUrl: string | null;
  notes: string | null;
}
interface StaffOption {
  id: string;
  name: string;
}

const CATEGORIES: Array<DocRow["category"]> = ["contract", "license", "insurance", "certificate", "other"];
const empty = { title: "", category: "contract", userId: "", issuedDate: "", expiryDate: "", notes: "" };

function statusOf(expiry: string | null) {
  if (!expiry) return { label: "No expiry", tone: "bg-slate-100 text-slate-500" };
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  if (expiry < today) return { label: "Expired", tone: "bg-red-100 text-red-700" };
  if (expiry <= soon) return { label: "Expiring soon", tone: "bg-amber-100 text-amber-700" };
  return { label: "Valid", tone: "bg-emerald-100 text-emerald-700" };
}

export default function DocumentsPage() {
  const toast = useToast();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<DocRow | "new" | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<DocRow | null>(null);
  const [file, setFile] = useState<{ name: string; path: string } | null>(null);
  const [fileBusy, setFileBusy] = useState(false);

  async function load() {
    try {
      const data = await api<{ documents: DocRow[] }>("/api/documents");
      setDocs(data.documents);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load documents");
    }
  }

  useEffect(() => {
    load();
    api<{ users: StaffOption[] }>("/api/users")
      .then((d) => setStaff(d.users))
      .catch(() => undefined);
  }, []);

  function openNew() {
    setForm(empty);
    setFile(null);
    setModal("new");
  }
  function openEdit(d: DocRow) {
    setForm({
      title: d.title,
      category: d.category,
      userId: d.userId ?? "",
      issuedDate: d.issuedDate ?? "",
      expiryDate: d.expiryDate ?? "",
      notes: d.notes ?? "",
    });
    setFile(null);
    setModal(d);
  }

  async function uploadFile(f: File) {
    setFileBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await api<{ file_name: string; file_path: string }>("/api/documents/upload", {
        method: "POST",
        body: fd,
      });
      setFile({ name: res.file_name, path: res.file_path });
      toast.success("File attached");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setFileBusy(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (modal === "new") {
        await api("/api/documents", {
          method: "POST",
          json: {
            title: form.title,
            category: form.category,
            userId: form.userId || undefined,
            issuedDate: form.issuedDate || undefined,
            expiryDate: form.expiryDate || undefined,
            notes: form.notes || undefined,
            fileName: file?.name,
            fileId: file?.path,
          },
        });
        toast.success("Document added");
      } else if (modal) {
        await api(`/api/documents/${modal.id}`, {
          method: "PATCH",
          json: {
            title: form.title,
            category: form.category,
            userId: form.userId || null,
            issuedDate: form.issuedDate || null,
            expiryDate: form.expiryDate || null,
            notes: form.notes || null,
          },
        });
        toast.success("Document updated");
      }
      setModal(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/api/documents/${deleting.id}`, { method: "DELETE" });
      toast.success("Document deleted");
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Documents & expiry"
        subtitle="Staff contracts, licenses, insurance and certificates — with expiry tracking and reminders."
        action={<button className="btn-primary" onClick={openNew}>+ Add document</button>}
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Document</th>
              <th>Category</th>
              <th>Person</th>
              <th>Issued</th>
              <th>Expiry</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => {
              const st = statusOf(d.expiryDate);
              return (
                <tr key={d.id}>
                  <td className="font-medium">
                    {d.title}
                    {d.fileUrl && (
                      <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs font-medium text-indigo-600 hover:underline">
                        file
                      </a>
                    )}
                  </td>
                  <td className="capitalize text-slate-600">{d.category}</td>
                  <td>{d.userName ?? "Company-wide"}</td>
                  <td>{d.issuedDate ?? "—"}</td>
                  <td>{d.expiryDate ?? "—"}</td>
                  <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.tone}`}>{st.label}</span></td>
                  <td className="whitespace-nowrap text-right">
                    <button onClick={() => openEdit(d)} className="btn-secondary btn-xs">Edit</button>
                    <button onClick={() => setDeleting(d)} className="btn-danger ml-1 btn-xs">Delete</button>
                  </td>
                </tr>
              );
            })}
            {docs.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-sm text-slate-500">No documents yet. Add contracts, licenses or insurance to start tracking expiry.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === "new" ? "Add document" : "Edit document"} onClose={() => setModal(null)}>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="label">Title</label>
              <input className="input" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Employment contract" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                  {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Person (optional)</label>
                <select className="input" value={form.userId} onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))}>
                  <option value="">Company-wide</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Issued date</label><input type="date" className="input" value={form.issuedDate} onChange={(e) => setForm((p) => ({ ...p, issuedDate: e.target.value }))} /></div>
              <div><label className="label">Expiry date</label><input type="date" className="input" value={form.expiryDate} onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))} /></div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional" />
            </div>
            {modal === "new" && (
              <div>
                <label className="label">Attach a file (optional)</label>
                <input
                  type="file"
                  className="input"
                  disabled={fileBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f);
                  }}
                />
                <p className="mt-1 text-xs text-slate-400">
                  {fileBusy ? "Uploading…" : file ? `Attached: ${file.name}` : "PDF, Word or image up to 10MB."}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving…" : modal === "new" ? "Add document" : "Save changes"}</button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete document"
        message={<span>Delete <strong>{deleting?.title}</strong>? Any attached file is removed too.</span>}
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
