"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Alert, api } from "@/components/ui";
import { useToast } from "@/components/toast";

interface Item {
  id: string;
  title: string;
  done: boolean;
  done_at: number | null;
}
interface Person {
  user_id: string;
  name: string;
  role: string;
  active: boolean;
  department_id: string | null;
  onboarding: Item[];
  offboarding: Item[];
}

export default function ChecklistsPage() {
  const toast = useToast();
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"onboarding" | "offboarding">("onboarding");
  const [newItem, setNewItem] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await api<{ people: Person[] }>("/api/checklists");
      setPeople(data.people);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load checklists");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(
    () => people.filter((p) => (tab === "onboarding" ? p.active : !p.active)),
    [people, tab]
  );

  async function toggle(id: string, done: boolean) {
    try {
      await api(`/api/checklists/${id}`, { method: "PATCH", json: { done } });
      setPeople((prev) =>
        prev.map((p) => ({
          ...p,
          onboarding: p.onboarding.map((i) => (i.id === id ? { ...i, done } : i)),
          offboarding: p.offboarding.map((i) => (i.id === id ? { ...i, done } : i)),
        }))
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  }

  async function addItem(userId: string) {
    const title = (newItem[userId] ?? "").trim();
    if (!title) return;
    setBusy(true);
    try {
      await api("/api/checklists", { method: "POST", json: { userId, kind: tab, title } });
      setNewItem((p) => ({ ...p, [userId]: "" }));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add item");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id: string) {
    try {
      await api(`/api/checklists/${id}`, { method: "DELETE" });
      setPeople((prev) =>
        prev.map((p) => ({
          ...p,
          onboarding: p.onboarding.filter((i) => i.id !== id),
          offboarding: p.offboarding.filter((i) => i.id !== id),
        }))
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <>
      <PageHeader
        title="Onboarding & offboarding"
        subtitle="Track the steps for new hires and for staff leaving the company."
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="mb-5 flex rounded-lg border border-slate-200 bg-white p-1">
        <button onClick={() => setTab("onboarding")} className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === "onboarding" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
          Onboarding
        </button>
        <button onClick={() => setTab("offboarding")} className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === "offboarding" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
          Offboarding
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {shown.map((p) => {
          const items = tab === "onboarding" ? p.onboarding : p.offboarding;
          const done = items.filter((i) => i.done).length;
          const pct = items.length ? Math.round((done / items.length) * 100) : 0;
          return (
            <div key={p.user_id} className="card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-800">{p.name}</p>
                  <p className="text-xs capitalize text-slate-400">{p.role}</p>
                </div>
                <span className="text-sm font-semibold text-slate-500">{done}/{items.length}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
              </div>

              <ul className="mt-3 space-y-1.5">
                {items.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={i.done} onChange={(e) => toggle(i.id, e.target.checked)} className="h-4 w-4 accent-indigo-600" />
                    <span className={i.done ? "flex-1 text-slate-400 line-through" : "flex-1 text-slate-700"}>{i.title}</span>
                    <button onClick={() => removeItem(i.id)} className="text-xs text-slate-300 transition hover:text-red-500" aria-label="Delete item">×</button>
                  </li>
                ))}
                {items.length === 0 && <li className="text-sm text-slate-400">No items yet.</li>}
              </ul>

              <div className="mt-3 flex gap-2">
                <input
                  className="input py-1.5 text-sm"
                  placeholder="Add a step…"
                  value={newItem[p.user_id] ?? ""}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, [p.user_id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") addItem(p.user_id); }}
                />
                <button className="btn-secondary px-3 py-1.5 text-sm" onClick={() => addItem(p.user_id)} disabled={busy}>Add</button>
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <p className="text-sm text-slate-500">No one in this list.</p>}
      </div>
    </>
  );
}
