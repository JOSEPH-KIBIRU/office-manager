"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Alert, Modal, api, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";

interface BankAccount {
  id: string;
  kind: "bank" | "mpesa";
  name: string;
  bankName: string | null;
  accountNumber: string | null;
  currency: string;
  openingBalance: number;
  accountCode: string;
  paybill: string | null;
  till: string | null;
  businessNumber: string | null;
  active: boolean;
  currentBalance: number;
}

const fmtKsh = (n: number) => "KSh " + n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const empty = {
  kind: "bank" as "bank" | "mpesa",
  name: "",
  bankName: "",
  accountNumber: "",
  currency: "KES",
  openingBalance: "",
  paybill: "",
  till: "",
  businessNumber: "",
};

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<typeof empty | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const d = await api<{ accounts: BankAccount[] }>("/api/banking/accounts");
      setAccounts(d.accounts);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!form) return;
    if (!form.name.trim()) { setError("Account name is required."); return; }
    setBusy(true);
    setError(null);
    try {
      await api("/api/banking/accounts", {
        method: "POST",
        json: {
          kind: form.kind,
          name: form.name,
          bankName: form.bankName,
          accountNumber: form.accountNumber,
          currency: form.currency,
          openingBalance: form.openingBalance === "" ? 0 : Number(form.openingBalance),
          paybill: form.paybill,
          till: form.till,
          businessNumber: form.businessNumber,
        },
      });
      toast.success("Account created.");
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create account");
    } finally { setBusy(false); }
  }

  async function setActive(id: string, active: boolean) {
    try {
      await api(`/api/banking/accounts/${id}`, { method: "PATCH", json: { active } });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank & M-Pesa accounts"
        subtitle="Each account links to a cash/bank ledger account. Opening balances post as controlled opening entries (never income)."
      />
      {error && <Alert kind="error">{error}</Alert>}
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setForm({ ...empty })}>+ New account</button>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading…</p> : accounts.length === 0 ? (
        <p className="card p-6 text-sm text-slate-400">No accounts yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Bank / Number</th>
                <th className="px-4 py-3">Ledger</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((a) => (
                <tr key={a.id} className={a.active ? "" : "opacity-50"}>
                  <td className="px-4 py-3 font-medium text-slate-800">{a.name}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{a.kind}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {a.bankName ?? (a.paybill ? `Paybill ${a.paybill}` : a.till ? `Till ${a.till}` : "—")}
                    {a.accountNumber && <span className="block text-xs text-slate-400">{a.accountNumber}</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">{a.accountCode}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${a.currentBalance < 0 ? "text-red-600" : "text-slate-700"}`}>{fmtKsh(a.currentBalance)}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-secondary btn-xs" onClick={() => setActive(a.id, !a.active)}>
                      {a.active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal title="New bank / M-Pesa account" onClose={() => setForm(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select className={inputCls()} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as never })}>
                  <option value="bank">Bank</option>
                  <option value="mpesa">M-Pesa</option>
                </select>
              </div>
              <div>
                <label className="label">Currency</label>
                <input className={inputCls()} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Account name</label>
              <input className={inputCls()} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            {form.kind === "bank" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Bank</label>
                  <input className={inputCls()} value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
                </div>
                <div>
                  <label className="label">Account number</label>
                  <input className={inputCls()} value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Paybill</label>
                  <input className={inputCls()} value={form.paybill} onChange={(e) => setForm({ ...form, paybill: e.target.value })} />
                </div>
                <div>
                  <label className="label">Till</label>
                  <input className={inputCls()} value={form.till} onChange={(e) => setForm({ ...form, till: e.target.value })} />
                </div>
                <div>
                  <label className="label">Business no.</label>
                  <input className={inputCls()} value={form.businessNumber} onChange={(e) => setForm({ ...form, businessNumber: e.target.value })} />
                </div>
              </div>
            )}
            <div>
              <label className="label">Opening balance</label>
              <input type="number" className={inputCls()} value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} />
            </div>
            <p className="text-xs text-slate-400">
              If you don&apos;t link a ledger account, one is created automatically (asset · cash) and the opening
              balance is posted against Suspense.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Create account"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
