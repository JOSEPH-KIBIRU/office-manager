"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { PageHeader, Alert, Modal, ConfirmDialog, api } from "@/components/ui";
import { useToast } from "@/components/toast";

interface AssetRow {
  id: string;
  tag: string;
  name: string;
  category: string | null;
  serialNumber: string | null;
  condition: string | null;
  status: "available" | "assigned" | "maintenance" | "retired";
  holderId: string | null;
  holderName: string | null;
  checkedOutAt: number | null;
  checkedOutAtText: string | null;
  active: boolean;
  created_at: string;
}

interface StaffOption {
  id: string;
  name: string;
  role: string;
}

interface MovementRow {
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

const STATUS_TONE: Record<AssetRow["status"], string> = {
  available: "bg-emerald-50 text-emerald-700",
  assigned: "bg-blue-50 text-blue-700",
  maintenance: "bg-amber-50 text-amber-700",
  retired: "bg-slate-100 text-slate-500",
};

function nowLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyAssetForm = { tag: "", name: "", category: "", serialNumber: "", condition: "" };

export default function AssetsPage() {
  const toast = useToast();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // register / edit asset
  const [assetModal, setAssetModal] = useState<AssetRow | "new" | null>(null);
  const [assetForm, setAssetForm] = useState(emptyAssetForm);
  const [saving, setSaving] = useState(false);

  // allocate
  const [allocateFor, setAllocateFor] = useState<AssetRow | null>(null);
  const [allocForm, setAllocForm] = useState({ holderId: "", at: nowLocal(), destination: "", condition: "", note: "" });

  // return
  const [returnFor, setReturnFor] = useState<AssetRow | null>(null);
  const [retForm, setRetForm] = useState({ condition: "", note: "", at: nowLocal() });

  const [deleting, setDeleting] = useState<AssetRow | null>(null);

  // filters
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filterAsset, setFilterAsset] = useState("");
  const [filterHolder, setFilterHolder] = useState("");

  async function load() {
    setError(null);
    try {
      const [a, m] = await Promise.all([
        api<{ assets: AssetRow[] }>("/api/assets"),
        api<{ movements: MovementRow[] }>("/api/assets/movements"),
      ]);
      setAssets(a.assets);
      setMovements(m.movements);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function loadMovements() {
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", String(new Date(from + "T00:00:00").getTime()));
      if (to) params.set("to", String(new Date(to + "T23:59:59").getTime()));
      if (filterAsset) params.set("assetId", filterAsset);
      if (filterHolder) params.set("holderId", filterHolder);
      const qs = params.toString();
      const m = await api<{ movements: MovementRow[] }>(`/api/assets/movements${qs ? `?${qs}` : ""}`);
      setMovements(m.movements);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    api<{ users: StaffOption[] }>("/api/users")
      .then((d) => setStaff(d.users))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const staffName = useMemo(() => {
    const m = new Map(staff.map((s) => [s.id, s.name]));
    return (id: string) => m.get(id) ?? "—";
  }, [staff]);

  // assets that currently have an open checkout, for the filter dropdown
  const holders = useMemo(() => {
    const ids = new Set(movements.map((m) => m.holderId));
    return staff.filter((s) => ids.has(s.id));
  }, [movements, staff]);

  function openNew() {
    setAssetForm(emptyAssetForm);
    setAssetModal("new");
  }
  function openEdit(a: AssetRow) {
    setAssetForm({
      tag: a.tag,
      name: a.name,
      category: a.category ?? "",
      serialNumber: a.serialNumber ?? "",
      condition: a.condition ?? "",
    });
    setAssetModal(a);
  }

  async function saveAsset(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (assetModal === "new") {
        await api("/api/assets", { method: "POST", json: assetForm });
        toast.success("Asset registered");
      } else if (assetModal) {
        await api(`/api/assets/${assetModal.id}`, { method: "PATCH", json: assetForm });
        toast.success("Asset updated");
      }
      setAssetModal(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function openAllocate(a: AssetRow) {
    setAllocForm({ holderId: "", at: nowLocal(), destination: "", condition: a.condition ?? "", note: "" });
    setAllocateFor(a);
  }

  async function doAllocate(e: FormEvent) {
    e.preventDefault();
    if (!allocateFor) return;
    setSaving(true);
    try {
      await api("/api/assets/movements", {
        method: "POST",
        json: {
          kind: "allocate",
          assetId: allocateFor.id,
          holderId: allocForm.holderId,
          at: new Date(allocForm.at).getTime(),
          destination: allocForm.destination,
          condition: allocForm.condition,
          note: allocForm.note,
        },
      });
      toast.success(`${allocateFor.name} allocated`);
      setAllocateFor(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function openReturn(a: AssetRow) {
    setRetForm({ condition: a.condition ?? "", note: "", at: nowLocal() });
    setReturnFor(a);
  }

  async function doReturn(e: FormEvent) {
    e.preventDefault();
    if (!returnFor) return;
    setSaving(true);
    try {
      await api("/api/assets/movements", {
        method: "POST",
        json: {
          kind: "return",
          assetId: returnFor.id,
          at: new Date(retForm.at).getTime(),
          condition: retForm.condition,
          note: retForm.note,
        },
      });
      toast.success(`${returnFor.name} returned`);
      setReturnFor(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await api(`/api/assets/${deleting.id}`, { method: "DELETE" });
      toast.success("Asset deleted");
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const rows: string[][] = [
      ["Date/time", "Action", "Asset", "Tag", "Holder", "Destination", "Condition", "Recorded by", "Note"],
      ...movements.map((m) => [
        m.atText,
        m.action === "checkout" ? "Allocated" : "Returned",
        m.assetName,
        m.assetTag,
        m.holderName,
        m.destination ?? "",
        m.condition ?? "",
        m.recordedByName ?? "",
        m.note ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asset-movements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Asset movement"
        subtitle="Register office assets, allocate them to staff going to the field, and keep a complete custody trail of who has what."
        action={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={exportCsv} disabled={movements.length === 0}>Export CSV</button>
            <button className="btn-primary" onClick={openNew}>+ Register asset</button>
          </div>
        }
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="card mb-6 overflow-x-auto">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">Asset register</h2>
        <table className="table-base">
          <thead>
            <tr>
              <th>Tag</th>
              <th>Asset</th>
              <th>Category</th>
              <th>Serial</th>
              <th>Condition</th>
              <th>Status</th>
              <th>Currently with</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id}>
                <td className="font-medium">{a.tag}</td>
                <td className="font-medium">{a.name}</td>
                <td>{a.category ?? "—"}</td>
                <td>{a.serialNumber ?? "—"}</td>
                <td>{a.condition ?? "—"}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_TONE[a.status]}`}>{a.status}</span></td>
                <td>
                  {a.status === "assigned" && a.holderName ? (
                    <span>
                      {a.holderName}
                      {a.checkedOutAtText && <span className="ml-1 text-xs text-slate-400">since {a.checkedOutAtText}</span>}
                    </span>
                  ) : "—"}
                </td>
                <td className="whitespace-nowrap text-right">
                  {a.status === "available" && <button onClick={() => openAllocate(a)} className="btn-primary px-2 py-1 text-xs">Allocate</button>}
                  {a.status === "assigned" && <button onClick={() => openReturn(a)} className="btn-success px-2 py-1 text-xs">Return</button>}
                  <button onClick={() => openEdit(a)} className="btn-secondary ml-1 px-2 py-1 text-xs">Edit</button>
                  <button onClick={() => setDeleting(a)} className="btn-danger ml-1 px-2 py-1 text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {assets.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-sm text-slate-500">No assets registered yet. Click “Register asset” to add one.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="label">From</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="label">To</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div>
            <label className="label">Asset</label>
            <select className="input" value={filterAsset} onChange={(e) => setFilterAsset(e.target.value)}>
              <option value="">All assets</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.tag} · {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Person</label>
            <select className="input" value={filterHolder} onChange={(e) => setFilterHolder(e.target.value)}>
              <option value="">Anyone</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button className="btn-secondary" onClick={loadMovements}>Apply</button>
          <button className="btn-secondary" onClick={() => { setFrom(""); setTo(""); setFilterAsset(""); setFilterHolder(""); setTimeout(loadMovements, 0); }}>Clear</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">Movement trail</h2>
        <table className="table-base">
          <thead>
            <tr><th>Date / time</th><th>Action</th><th>Asset</th><th>Holder</th><th>Destination</th><th>Condition</th><th>Recorded by</th></tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap text-slate-500">{m.atText}</td>
                <td>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m.action === "checkout" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {m.action === "checkout" ? "Allocated" : "Returned"}
                  </span>
                </td>
                <td className="font-medium">{m.assetName} <span className="text-xs text-slate-400">{m.assetTag}</span></td>
                <td>{m.holderName}</td>
                <td>{m.destination ?? "—"}</td>
                <td>{m.condition ?? "—"}</td>
                <td>{m.recordedByName ?? staffName(m.holderId)}</td>
              </tr>
            ))}
            {movements.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-sm text-slate-500">No movements recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {assetModal && (
        <Modal title={assetModal === "new" ? "Register asset" : "Edit asset"} onClose={() => setAssetModal(null)}>
          <form onSubmit={saveAsset} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Tag / asset no.</label><input className="input" value={assetForm.tag} onChange={(e) => setAssetForm((p) => ({ ...p, tag: e.target.value }))} placeholder="e.g. LAP-001" required /></div>
              <div><label className="label">Category</label><input className="input" value={assetForm.category} onChange={(e) => setAssetForm((p) => ({ ...p, category: e.target.value }))} placeholder="e.g. Laptop" /></div>
            </div>
            <div><label className="label">Asset name</label><input className="input" value={assetForm.name} onChange={(e) => setAssetForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. HP EliteBook" required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Serial number</label><input className="input" value={assetForm.serialNumber} onChange={(e) => setAssetForm((p) => ({ ...p, serialNumber: e.target.value }))} placeholder="Optional" /></div>
              <div><label className="label">Condition</label><input className="input" value={assetForm.condition} onChange={(e) => setAssetForm((p) => ({ ...p, condition: e.target.value }))} placeholder="e.g. Good" /></div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setAssetModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : assetModal === "new" ? "Register" : "Save changes"}</button>
            </div>
          </form>
        </Modal>
      )}

      {allocateFor && (
        <Modal title={`Allocate — ${allocateFor.name}`} onClose={() => setAllocateFor(null)}>
          <form onSubmit={doAllocate} className="space-y-4">
            <div>
              <label className="label">Give to</label>
              <select className="input" value={allocForm.holderId} onChange={(e) => setAllocForm((p) => ({ ...p, holderId: e.target.value }))} required>
                <option value="">Select a person…</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Date &amp; time out</label><input type="datetime-local" className="input" value={allocForm.at} onChange={(e) => setAllocForm((p) => ({ ...p, at: e.target.value }))} required /></div>
              <div><label className="label">Destination / field site</label><input className="input" value={allocForm.destination} onChange={(e) => setAllocForm((p) => ({ ...p, destination: e.target.value }))} placeholder="e.g. Kisumu site" /></div>
            </div>
            <div><label className="label">Condition out</label><input className="input" value={allocForm.condition} onChange={(e) => setAllocForm((p) => ({ ...p, condition: e.target.value }))} placeholder="e.g. Good" /></div>
            <div><label className="label">Note</label><input className="input" value={allocForm.note} onChange={(e) => setAllocForm((p) => ({ ...p, note: e.target.value }))} placeholder="Optional" /></div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setAllocateFor(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Allocate asset"}</button>
            </div>
          </form>
        </Modal>
      )}

      {returnFor && (
        <Modal title={`Return — ${returnFor.name}`} onClose={() => setReturnFor(null)}>
          <form onSubmit={doReturn} className="space-y-4">
            <p className="text-sm text-slate-500">
              Held by <strong>{returnFor.holderName}</strong>{returnFor.checkedOutAtText ? ` since ${returnFor.checkedOutAtText}` : ""}.
            </p>
            <div><label className="label">Date &amp; time in</label><input type="datetime-local" className="input" value={retForm.at} onChange={(e) => setRetForm((p) => ({ ...p, at: e.target.value }))} required /></div>
            <div><label className="label">Condition in</label><input className="input" value={retForm.condition} onChange={(e) => setRetForm((p) => ({ ...p, condition: e.target.value }))} placeholder="e.g. Good / damaged" /></div>
            <div><label className="label">Note</label><input className="input" value={retForm.note} onChange={(e) => setRetForm((p) => ({ ...p, note: e.target.value }))} placeholder="Optional" /></div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setReturnFor(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Record return"}</button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete asset"
        message={<span>Delete <strong>{deleting?.name}</strong> ({deleting?.tag}) from the register? Its movement history is kept.</span>}
        busy={saving}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
