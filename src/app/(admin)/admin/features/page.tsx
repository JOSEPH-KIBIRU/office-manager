"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Alert, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import { MODULES } from "@/lib/permissions";

interface Company {
  id: string;
  name: string;
  active: boolean;
  enabledModules: string[] | null;
}

const GROUP_ORDER = ["Overview", "People & HR", "Finance", "Management", "Reporting", "Operations", "Company"];

export default function FeaturesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [allEnabled, setAllEnabled] = useState(true);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    api<{ companies: Company[] }>("/api/admin/features")
      .then((d) => {
        setCompanies(d.companies);
        const first = d.companies[0];
        if (first) applyCompany(first);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load companies"))
      .finally(() => setLoading(false));
  }, []);

  function applyCompany(c: Company) {
    setSelectedId(c.id);
    if (c.enabledModules === null) {
      setAllEnabled(true);
      setEnabled(new Set(MODULES.map((m) => m.key)));
    } else {
      setAllEnabled(false);
      setEnabled(new Set(c.enabledModules));
    }
  }

  function selectCompany(id: string) {
    const c = companies.find((x) => x.id === id);
    if (c) applyCompany(c);
  }

  function toggle(key: string) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const modules = allEnabled ? null : Array.from(enabled);
      await api("/api/admin/features", { method: "PATCH", json: { orgId: selectedId, modules } });
      setCompanies((prev) =>
        prev.map((c) => (c.id === selectedId ? { ...c, enabledModules: modules } : c))
      );
      toast.success("Feature access saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string }[]>();
    for (const def of MODULES) {
      const list = map.get(def.group) ?? [];
      list.push({ key: def.key, label: def.label });
      map.set(def.group, list);
    }
    return map;
  }, []);

  const selected = companies.find((c) => c.id === selectedId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modules & features"
        subtitle="Mask sidebar functions per company. Anything disabled here is hidden from the company and cannot be granted in their Roles & permissions tab."
      />

      {error && <Alert kind="error">{error}</Alert>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="card max-w-xl p-5">
            <label className="mb-1 block text-sm font-medium text-slate-700">Company</label>
            <select className="input" value={selectedId} onChange={(e) => selectCompany(e.target.value)}>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.enabledModules !== null ? ` — ${c.enabledModules.length}/${MODULES.length} modules` : " — all modules"}
                </option>
              ))}
            </select>
            {companies.length === 0 && <p className="mt-2 text-sm text-slate-400">No companies yet.</p>}
          </div>

          {selected && (
            <div className="card max-w-3xl p-6">
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={allEnabled}
                  onChange={(e) => setAllEnabled(e.target.checked)}
                  className="h-4 w-4"
                />
                All modules enabled (unrestricted)
              </label>

              {!allEnabled && (
                <div className="mt-5 space-y-5">
                  <div className="flex justify-end gap-3">
                    <button type="button" className="btn-secondary text-xs" onClick={() => setEnabled(new Set())}>
                      Clear all
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => setEnabled(new Set(MODULES.map((m) => m.key)))}
                    >
                      Select all
                    </button>
                  </div>
                  {GROUP_ORDER.map((g) => {
                    const items = groups.get(g);
                    if (!items?.length) return null;
                    return (
                      <fieldset key={g}>
                        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                          {g}
                        </legend>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {items.map((m) => (
                            <label
                              key={m.key}
                              className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={enabled.has(m.key)}
                                onChange={() => toggle(m.key)}
                                className="h-4 w-4"
                              />
                              {m.label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    );
                  })}
                </div>
              )}

              <div className="mt-6 flex items-center gap-3 border-t border-slate-200 pt-5">
                <button type="button" className="btn-primary px-5 py-2.5" disabled={busy} onClick={save}>
                  {busy ? "Saving…" : "Save feature access"}
                </button>
                {!allEnabled && (
                  <span className="text-xs text-slate-500">{enabled.size} of {MODULES.length} modules enabled</span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
