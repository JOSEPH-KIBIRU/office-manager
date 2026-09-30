"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, Alert, api } from "@/components/ui";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/toast";
import { PLANS, annualPrice, formatKes, type PlanKey, type BillingCycle } from "@/lib/plans";

type Status = "trial" | "active" | "canceled" | "past_due";

interface Company {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  userCount: number;
  plan: PlanKey | null;
  billingCycle: BillingCycle | null;
  status: Status | null;
  trialEndsAt: number | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
}

interface Draft {
  plan: PlanKey;
  billingCycle: BillingCycle;
  status: Status;
}

const STATUS_OPTIONS: Status[] = ["trial", "active", "past_due", "canceled"];

function fmtDate(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
}

export default function SubscriptionsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const d = await api<{ companies: Company[] }>("/api/admin/subscriptions");
      setCompanies(d.companies);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function effective(c: Company): Draft {
    return (
      drafts[c.id] ?? {
        plan: c.plan ?? "starter",
        billingCycle: c.billingCycle ?? "monthly",
        status: c.status ?? "trial",
      }
    );
  }

  function update(c: Company, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [c.id]: { ...effective(c), ...patch } }));
  }

  async function save(c: Company) {
    const draft = effective(c);
    setBusyId(c.id);
    setError(null);
    try {
      await api("/api/admin/subscriptions", {
        method: "PATCH",
        json: { orgId: c.id, ...draft },
      });
      toast.success(`${c.name} updated.`);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[c.id];
        return next;
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusyId(null);
    }
  }

  async function action(c: Company, act: "markPaid" | "cancel" | "startTrial") {
    setBusyId(c.id);
    setError(null);
    try {
      const draft = effective(c);
      await api("/api/admin/subscriptions", {
        method: "POST",
        json: { orgId: c.id, action: act, plan: draft.plan, billingCycle: draft.billingCycle },
      });
      toast.success(
        act === "markPaid" ? `${c.name} marked as paid.` : act === "cancel" ? `${c.name} cancelled.` : `${c.name} trial started.`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-slate-500">
        <Spinner className="h-5 w-5" /> Loading subscriptions…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        subtitle="Assign plans, record payments and cancel companies. Unpaid subscriptions are cancelled automatically on the 1st of each month."
      />

      {error && <Alert kind="error">{error}</Alert>}

      <div className="grid gap-3 sm:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.key} className="card p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-900">{p.name}</p>
              {p.highlight && <span className="badge bg-indigo-100 text-indigo-700">Popular</span>}
            </div>
            <p className="mt-1 text-sm text-slate-500">{p.usersLabel}</p>
            <p className="mt-2 text-lg font-bold text-slate-900">
              {p.monthly === null ? "Custom" : formatKes(p.monthly) + "/mo"}
            </p>
            {p.monthly !== null && (
              <p className="text-xs text-emerald-600">
                {formatKes(annualPrice(p.monthly))}/yr (5% off)
              </p>
            )}
          </div>
        ))}
      </div>

      {companies.length === 0 ? (
        <p className="text-sm text-slate-500">No companies found.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Users</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Billing</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Period ends</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const d = effective(c);
                const plan = PLANS.find((p) => p.key === d.plan);
                const overLimit = plan?.maxUsers != null && c.userCount > plan.maxUsers;
                const dirty = !!drafts[c.id];
                const busy = busyId === c.id;
                return (
                  <tr key={c.id} className="border-b border-slate-100 align-middle">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.slug}{!c.active && " · suspended"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={overLimit ? "font-semibold text-red-600" : "text-slate-700"}>
                        {c.userCount}
                      </span>
                      {plan?.maxUsers != null && (
                        <span className="ml-1 text-xs text-slate-400">/ {plan.maxUsers}</span>
                      )}
                      {overLimit && <p className="text-xs text-red-600">over plan limit</p>}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="input py-1.5 text-sm"
                        value={d.plan}
                        onChange={(e) => update(c, { plan: e.target.value as PlanKey })}
                      >
                        {PLANS.map((p) => (
                          <option key={p.key} value={p.key}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="input py-1.5 text-sm"
                        value={d.billingCycle}
                        onChange={(e) => update(c, { billingCycle: e.target.value as BillingCycle })}
                      >
                        <option value="monthly">Monthly</option>
                        <option value="annual">Annual (5% off)</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="input py-1.5 text-sm"
                        value={d.status}
                        onChange={(e) => update(c, { status: e.target.value as Status })}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s.replace("_", " ")}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {d.status === "trial" ? fmtDate(c.trialEndsAt) : fmtDate(c.currentPeriodEnd)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className="btn-primary px-3 py-1.5 text-xs"
                          disabled={!dirty || busy}
                          onClick={() => save(c)}
                        >
                          {busy ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary px-3 py-1.5 text-xs"
                          disabled={busy}
                          onClick={() => action(c, "markPaid")}
                        >
                          Mark paid
                        </button>
                        <button
                          type="button"
                          className="btn-secondary px-3 py-1.5 text-xs"
                          disabled={busy}
                          onClick={() => action(c, "startTrial")}
                        >
                          Start trial
                        </button>
                        <button
                          type="button"
                          className="btn-danger px-3 py-1.5 text-xs"
                          disabled={busy || d.status === "canceled"}
                          onClick={() => action(c, "cancel")}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}