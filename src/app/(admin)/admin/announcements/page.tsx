"use client";

import { useEffect, useState, FormEvent } from "react";
import { Alert, PageHeader, ConfirmDialog, api } from "@/components/ui";

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Colour ${c}`}
          className={`h-8 w-8 rounded-full border-2 transition ${value.toLowerCase() === c ? "scale-110 border-slate-900 ring-2 ring-slate-300" : "border-white shadow"}`}
          style={{ backgroundColor: c }}
        />
      ))}
      <label
        className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600"
        style={{ borderLeft: `4px solid ${value}` }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-7 cursor-pointer border-0 bg-transparent p-0"
        />
        <span className="font-mono text-xs">{value}</span>
        <span className="text-xs">Custom</span>
      </label>
    </div>
  );
}

interface Announcement {
  id: string;
  message: string;
  type: string;
  link: string | null;
  active: boolean;
  createdAt: number | string;
  updatedAt: string | null;
  color: string | null;
}

const TYPES: { value: string; label: string }[] = [
  { value: "info", label: "Information" },
  { value: "maintenance", label: "Maintenance" },
  { value: "training", label: "Training" },
  { value: "offer", label: "Offer / promo" },
  { value: "outage", label: "Outage / downtime" },
];

const TYPE_STYLES: Record<string, string> = {
  info: "bg-sky-100 text-sky-800",
  maintenance: "bg-amber-100 text-amber-800",
  training: "bg-violet-100 text-violet-800",
  offer: "bg-emerald-100 text-emerald-800",
  outage: "bg-red-100 text-red-700",
};

const PRESET_COLORS = [
  "#2563eb", // blue
  "#7c3aed", // violet
  "#db2777", // pink
  "#059669", // emerald
  "#d97706", // amber
  "#dc2626", // red
  "#0891b2", // cyan
  "#4f46e5", // indigo
];

function textForHex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 160 ? "text-slate-900" : "text-white";
}

function fmt(ts: number | string | null) {
  if (!ts) return "—";
  const d = typeof ts === "number" || /^\d+$/.test(ts) ? new Date(typeof ts === "number" ? ts : Number(ts)) : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toISOString().replace("T", " ").slice(0, 16);
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [link, setLink] = useState("");
  const [active, setActive] = useState(true);
  const [color, setColor] = useState(PRESET_COLORS[0]);

  const [editing, setEditing] = useState<Announcement | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [edMessage, setEdMessage] = useState("");
  const [edType, setEdType] = useState("info");
  const [edLink, setEdLink] = useState("");
  const [edActive, setEdActive] = useState(true);
  const [edColor, setEdColor] = useState(PRESET_COLORS[0]);

  async function load() {
    try {
      const data = await api<{ announcements: Announcement[] }>("/api/admin/announcements");
      setItems(data.announcements);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load announcements");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function post(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api("/api/admin/announcements", {
        method: "POST",
        json: { message, type, link, active, color },
      });
      setNotice("Announcement posted. It is now visible to all users.");
      setMessage("");
      setLink("");
      setType("info");
      setActive(true);
      setColor(PRESET_COLORS[0]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post announcement");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item: Announcement) {
    setError(null);
    try {
      await api(`/api/admin/announcements/${item.id}`, {
        method: "PATCH",
        json: { active: !item.active },
      });
      setNotice(item.active ? "Announcement hidden." : "Announcement is now live.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function changeColor(item: Announcement, color: string) {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
    setError(null);
    try {
      await api(`/api/admin/announcements/${item.id}`, {
        method: "PATCH",
        json: { color },
      });
      setNotice(`Banner colour updated.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function remove() {
    const item = deleting;
    if (!item) return;
    setDeleteBusy(true);
    setError(null);
    try {
      await api(`/api/admin/announcements/${item.id}`, { method: "DELETE" });
      setNotice("Announcement deleted.");
      setDeleting(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  }

  function openEdit(item: Announcement) {
    setEdMessage(item.message);
    setEdType(item.type);
    setEdLink(item.link || "");
    setEdActive(item.active);
    setEdColor(item.color || PRESET_COLORS[0]);
    setEditing(item);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api(`/api/admin/announcements/${editing.id}`, {
        method: "PATCH",
        json: { message: edMessage, type: edType, link: edLink, active: edActive, color: edColor },
      });
      setNotice("Announcement updated.");
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Announcements & offers"
        subtitle="Post messages shown in the banner at the top of every workspace — maintenance notices, free training, offers and more."
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {notice && <div className="mb-4"><Alert kind="success">{notice}</Alert></div>}

      {/* Post form */}
      <div className="card max-w-2xl p-6">
        <h2 className="mb-4 text-lg font-bold text-slate-900">New announcement</h2>
        <form onSubmit={post} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="input"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="e.g. Scheduled maintenance on Saturday 9:00 PM — the system will be briefly offline. Free KRA payroll training webinar coming next week — register early!"
              className="input"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Link (optional)</label>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              type="url"
              placeholder="https://..."
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Banner colour</label>
            <ColorPicker value={color} onChange={setColor} />
            <div className="mt-3 flex">
              <span
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${textForHex(color)}`}
                style={{ backgroundColor: color }}
              >
                Preview
              </span>
              <p className="ml-3 self-center text-xs text-slate-400">Pick a preset or tap to choose any RGB colour.</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4" />
            Show immediately (active)
          </label>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Posting…" : "Post announcement"}
          </button>
        </form>
      </div>

      {/* List */}
      <div className="card mt-6 overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Message</th>
              <th>Type</th>
              <th>Colour</th>
              <th>Status</th>
              <th>Updated</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-400">No announcements yet.</td>
              </tr>
            )}
            {items.map((it) => (
              <tr key={it.id}>
                <td>
                  <div className="max-w-md text-slate-800">{it.message}</div>
                  {it.link && (
                    <a href={it.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                      {it.link}
                    </a>
                  )}
                </td>
                <td><span className={`badge ${TYPE_STYLES[it.type] || "bg-slate-200 text-slate-700"}`}>{it.type}</span></td>
                <td>
                  <input
                    type="color"
                    value={it.color || "#2563eb"}
                    onChange={(e) => changeColor(it, e.target.value)}
                    title="Change banner colour"
                    className="h-7 w-9 cursor-pointer rounded border border-slate-200 bg-transparent p-0"
                  />
                </td>
                <td>
                  <span className={`badge ${it.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                    {it.active ? "live" : "hidden"}
                  </span>
                </td>
                <td className="text-slate-500">{fmt(it.updatedAt || it.createdAt)}</td>
                <td className="whitespace-nowrap text-right">
                  <button onClick={() => openEdit(it)} className="btn-secondary btn-xs">
                    Edit
                  </button>
                  <button onClick={() => toggle(it)} className={`btn-secondary ml-1 px-2 py-1 text-xs ${it.active ? "text-amber-700" : "text-emerald-700"}`}>
                    {it.active ? "Hide" : "Make live"}
                  </button>
                  <button onClick={() => setDeleting(it)} className="btn-secondary ml-1 px-2 py-1 text-xs text-red-600">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setEditing(null)}>
          <div className="card max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Edit announcement</h2>
              <button onClick={() => setEditing(null)} className="btn-secondary btn-xs">Close</button>
            </div>
            <form onSubmit={saveEdit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
                <select value={edType} onChange={(e) => setEdType(e.target.value)} className="input">
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
                <textarea
                  value={edMessage}
                  onChange={(e) => setEdMessage(e.target.value)}
                  rows={3}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Link (optional)</label>
                <input
                  value={edLink}
                  onChange={(e) => setEdLink(e.target.value)}
                  type="url"
                  placeholder="https://..."
                  className="input"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Banner colour</label>
                <ColorPicker value={edColor} onChange={setEdColor} />
                <div className="mt-3 flex">
                  <span
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${textForHex(edColor)}`}
                    style={{ backgroundColor: edColor }}
                  >
                    Preview
                  </span>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={edActive} onChange={(e) => setEdActive(e.target.checked)} className="h-4 w-4" />
                Show (active)
              </label>
              <div className="flex gap-2">
                <button type="submit" disabled={editBusy} className="btn-primary">
                  {editBusy ? "Saving…" : "Save changes"}
                </button>
                <button type="button" onClick={() => setEditing(null)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete announcement"
        message="Delete this announcement permanently?"
        busy={deleteBusy}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
