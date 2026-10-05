"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, Alert, Modal, ConfirmDialog, api, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";

interface Account {
  code: string;
  name: string;
  type: string;
  group: string;
  parentCode: string | null;
  category: string | null;
  control: string | null;
  taxTreatment: string | null;
  description: string | null;
  isCash: boolean;
  isVat: boolean;
  statutory: boolean;
  builtIn: boolean;
  active: boolean;
  balance: number;
  hasTransactions: boolean;
  hasChildren: boolean;
}

const TYPES = [
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
  { value: "equity", label: "Equity" },
  { value: "income", label: "Revenue" },
  { value: "cost_of_sales", label: "Cost of sales" },
  { value: "expense", label: "Expense" },
];

const CONTROLS = ["", "ar", "ap", "bank", "cash", "vat_input", "vat_output", "retained_earnings", "suspense"];
const TAX = ["", "vat_16", "vat_8", "zero_rated", "exempt", "out_of_scope", "none"];

const TYPE_ORDER = ["asset", "liability", "equity", "income", "cost_of_sales", "expense"];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPES.map((t) => [t.value, t.label]));

const fmtKsh = (n: number) => "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

interface Draft {
  code: string;
  name: string;
  type: string;
  group: string;
  parentCode: string;
  category: string;
  control: string;
  taxTreatment: string;
  isCash: boolean;
  isVat: boolean;
  statutory: boolean;
}

const EMPTY: Draft = {
  code: "",
  name: "",
  type: "expense",
  group: "",
  parentCode: "",
  category: "",
  control: "",
  taxTreatment: "",
  isCash: false,
  isVat: false,
  statutory: false,
};

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ original: string; draft: Draft } | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [archiveFor, setArchiveFor] = useState<Account | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const d = await api<{ accounts: Account[] }>("/api/accounting/chart");
      setAccounts(d.accounts);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chart of accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts
      .filter((a) => (showInactive ? true : a.active))
      .filter((a) => !q || a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
  }, [accounts, search, showInactive]);

  const byType = useMemo(() => {
    const map = new Map<string, Account[]>();
    for (const t of TYPE_ORDER) map.set(t, []);
    for (const a of visible) {
      const list = map.get(a.type);
      if (list) list.push(a);
    }
    return map;
  }, [visible]);

  function openNew() {
    setEditing({ original: "", draft: { ...EMPTY } });
  }
  function openEdit(a: Account) {
    setEditing({
      original: a.code,
      draft: {
        code: a.code,
        name: a.name,
        type: a.type,
        group: a.group,
        parentCode: a.parentCode ?? "",
        category: a.category ?? "",
        control: a.control ?? "",
        taxTreatment: a.taxTreatment ?? "",
        isCash: a.isCash,
        isVat: a.isVat,
        statutory: a.statutory,
      },
    });
  }

  async function save() {
    if (!editing) return;
    const d = editing.draft;
    if (!d.code.trim() || !d.name.trim()) {
      setError("Account code and name are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        newCode: d.code,
        name: d.name,
        type: d.type,
        group: d.group || TYPE_LABEL[d.type] || "Other",
        parentCode: d.parentCode,
        category: d.category,
        control: d.control,
        taxTreatment: d.taxTreatment,
        isCash: d.isCash,
        isVat: d.isVat,
        statutory: d.statutory,
      };
      if (editing.original) {
        await api(`/api/accounting/chart/${encodeURIComponent(editing.original)}`, { method: "PATCH", json: payload });
        toast.success("Account updated.");
      } else {
        await api("/api/accounting/chart", { method: "POST", json: payload });
        toast.success("Account created.");
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save account");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(a: Account) {
    setBusy(true);
    try {
      await api(`/api/accounting/chart/${encodeURIComponent(a.code)}`, {
        method: "PATCH",
        json: { active: !a.active },
      });
      toast.success(a.active ? "Account deactivated." : "Account reactivated.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update account");
    } finally {
      setBusy(false);
      setArchiveFor(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of accounts"
        subtitle="Assets, liabilities, equity, revenue, cost of sales and expenses. Accounts with posted transactions can be renamed but never deleted — deactivate them instead."
      />

      {error && <Alert kind="error">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search code or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
        <button className="btn-primary ml-auto" onClick={openNew}>
          + New account
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading chart of accounts…</p>
      ) : (
        <div className="space-y-6">
          {TYPE_ORDER.map((t) => {
            const list = byType.get(t) ?? [];
            if (list.length === 0) return null;
            return (
              <div key={t} className="card overflow-hidden">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {TYPE_LABEL[t]} · {list.length}
                </div>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2">Code</th>
                      <th className="px-4 py-2">Account</th>
                      <th className="px-4 py-2">Group</th>
                      <th className="px-4 py-2 text-right">Balance</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {list.map((a) => (
                      <tr key={a.code} className={a.active ? "" : "opacity-50"}>
                        <td className="px-4 py-2 font-mono text-slate-500">{a.code}</td>
                        <td className="px-4 py-2">
                          <span className={a.parentCode ? "pl-4 text-slate-700" : "font-medium text-slate-800"}>{a.name}</span>
                          <span className="ml-2 flex-inline gap-1">
                            {a.control && <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">{a.control}</span>}
                            {a.isCash && <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">cash</span>}
                            {a.isVat && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">VAT</span>}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-500">{a.group}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-700">{fmtKsh(a.balance)}</td>
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-2">
                            <button className="btn-secondary btn-xs" onClick={() => openEdit(a)}>Edit</button>
                            <button
                              className="btn-secondary btn-xs text-red-600"
                              onClick={() => setArchiveFor(a)}
                              disabled={busy}
                            >
                              {a.active ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <Modal title={editing.original ? `Edit ${editing.original}` : "New account"} onClose={() => setEditing(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Code</label>
                <input
                  className={inputCls()}
                  value={editing.draft.code}
                  onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, code: e.target.value } })}
                />
                {editing.original && (
                  <p className="mt-1 text-xs text-slate-400">Code can only change if the account has no transactions.</p>
                )}
              </div>
              <div>
                <label className="label">Type</label>
                <select
                  className={inputCls()}
                  value={editing.draft.type}
                  onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, type: e.target.value } })}
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Name</label>
              <input
                className={inputCls()}
                value={editing.draft.name}
                onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, name: e.target.value } })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Group</label>
                <input
                  className={inputCls()}
                  value={editing.draft.group}
                  placeholder="e.g. Operating expenses"
                  onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, group: e.target.value } })}
                />
              </div>
              <div>
                <label className="label">Parent account</label>
                <select
                  className={inputCls()}
                  value={editing.draft.parentCode}
                  onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, parentCode: e.target.value } })}
                >
                  <option value="">— none —</option>
                  {accounts.filter((a) => a.code !== editing.original).map((a) => (
                    <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Classification</label>
                <select
                  className={inputCls()}
                  value={editing.draft.category}
                  onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, category: e.target.value } })}
                >
                  <option value="">—</option>
                  <option value="current">Current</option>
                  <option value="non_current">Non-current</option>
                </select>
              </div>
              <div>
                <label className="label">Control account</label>
                <select
                  className={inputCls()}
                  value={editing.draft.control}
                  onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, control: e.target.value } })}
                >
                  {CONTROLS.map((c) => (
                    <option key={c} value={c}>{c || "—"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Tax treatment</label>
                <select
                  className={inputCls()}
                  value={editing.draft.taxTreatment}
                  onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, taxTreatment: e.target.value } })}
                >
                  {TAX.map((c) => (
                    <option key={c} value={c}>{c || "—"}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editing.draft.isCash} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, isCash: e.target.checked } })} />
                Cash / bank account
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editing.draft.isVat} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, isVat: e.target.checked } })} />
                VAT account
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editing.draft.statutory} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, statutory: e.target.checked } })} />
                Statutory
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save account"}</button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={archiveFor !== null}
        title={archiveFor?.active ? "Deactivate account" : "Reactivate account"}
        message={
          <>
            {archiveFor?.active
              ? <>Deactivate <strong>{archiveFor?.code} {archiveFor?.name}</strong>? It stays in history but won't be selectable for new entries.</>
              : <>Reactivate <strong>{archiveFor?.code} {archiveFor?.name}</strong>?</>}
          </>
        }
        confirmLabel={archiveFor?.active ? "Deactivate" : "Activate"}
        tone="default"
        busy={busy}
        onConfirm={() => archiveFor && toggleActive(archiveFor)}
        onCancel={() => setArchiveFor(null)}
      />
    </div>
  );
}
