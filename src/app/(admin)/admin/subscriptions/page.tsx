"use client";

import { useEffect, useState } from "react";
import { PageHeader, Alert, Loader } from "@/components/ui";
import { useToast } from "@/components/toast";
import { getSession } from "@/lib/auth";

interface CompanySubscription {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  plan: "starter" | "professional" | "enterprise" | null;
  billingCycle: "monthly" | "annual" | null;
  status: "trial" | "active" | "canceled" | "past_due" | null;
  userCount: number;
  trialEndsAt: number | null;
  currentPeriodEnd: number | null;
}

interface SaveForm {
  orgId: string;
  plan: "starter" | "professional" | "enterprise" | null;
  billingCycle: "monthly" | "annual" | null;
  status: "trial" | "active" | "canceled" | "past_due" | null;
}

export default function SubscriptionsPage() {
  const [companies, setCompanies] = useState<CompanySubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Map<string, SaveForm>>(new Map());
  const toast = useToast();

  useEffect(() => {
    fetch("/api/admin/subscriptions")
      .then((r) => r.json())
      .then((d) => {
        setCompanies(d.companies);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setError("Failed to load subscriptions");
        setLoading(false);
      });
  }, []);

  const handleSave = async (orgId: string) => {
    const form = editing.get(orgId);
    if (!form) return;

    setSaving(true);
    setError(null);
    try {
      await fetch("/api/admin/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      // Refresh the list
      const r = await fetch("/api/admin/subscriptions");
      const d = await r.json();
      setCompanies(d.companies);
      editing.delete(orgId);
      toast.success("Subscription updated.");
    } catch (e) {
      setError("Failed to update subscription");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader className="spinner spinner-primary" />
        <span className="ml-4 text-slate-600">Loading subscriptions…</span>
      </div>
    );
  }

  if (error) {
    return <Alert kind="error">{error}</Alert>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        subtitle="Manage company subscription plans and billing cycles"
      />

      {error && <Alert kind="error">{error}</Alert>}

      {companies.length === 0 && (
        <p className="text-sm text-slate-500">No companies found. Create a company first.</p>
      )}

      {companies.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full rounded border border-slate-200">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="p-4 text-left text-sm font-medium text-slate-700">Company</th>
                <th className="p-4 text-left text-sm font-medium text-slate-700">Plan</th>
                <th className="p-4 text-left text-sm font-medium text-slate-700">Billing</th>
                <th className="p-4 text-left text-sm font-medium text-slate-700">Status</th>
                <th className="p-4 text-left text-sm font-medium text-slate-700">Users</th>
                <th className="p-4 text-left text-sm font-medium text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className={editing.has(c.id) ? "bg-slate-50" : ""}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-slate-700">{c.name}</span>
                      <span className="text-xs text-slate-400">{c.slug}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <select
                      className="input input-bordered w-full"
                      disabled={editing.has(c.id)}
                      onChange={(e) =>
                        setEditing((prev) =>
                          prev.set(c.id, { ...prev.get(c.id)! , plan: e.target.value as any })
                        )}
                    >
                      <option value="" disabled>{-- Select plan --}</option>
                      <option value="starter" {c.plan === "starter" && "selected"}>
                        Starter (max 10 users, Ksh 3,500/mo after trial)
                      </option>
                      <option value="professional" {c.plan === "professional" && "selected">
                        Professional (11-20 users, Ksh 8,000/mo)
                      </option>
                      <option value="enterprise" {c.plan === "enterprise" && "selected">
                        Enterprise (contact us for >20 staff)
                      </option>
                    </select>
                  </td>
                  <td className="p-4">
                    <select
                      className="input input-bordered w-full"
                      disabled={editing.has(c.id)}
                      onChange={(e) =>
                        setEditing((prev) =>
                          prev.set(c.id, { ...prev.get(c.id)! , billingCycle: e.target.value as any })
                        )}
                    >
                      <option value="" disabled>{-- Select billing --}</option>
                      <option value="monthly" {c.billingCycle === "monthly" && "selected">
                        Monthly
                      </option>
                      <option value="annual" {c.billingCycle === "annual" && "selected">
                        Annual (5% discount)
                      </option>
                    </select>
                  </td>
                  <td className="p-4">
                    <select
                      className="input input-bordered w-full"
                      disabled={editing.has(c.id)}
                      onChange={(e) =>
                        setEditing((prev) =>
                          prev.set(c.id, { ...prev.get(c.id)! , status: e.target.value as any })
                        )}
                    >
                      <option value="" disabled>{-- Select status --}</option>
                      <option value="trial" {c.status === "trial" && "selected"}>
                        Trial
                      </option>
                      <option value="active" {c.status === "active" && "selected"}>
                        Active
                      </option>
                      <option value="canceled" {c.status === "canceled" && "selected"}>
                        Canceled
                      </option>
                      <option value="past_due" {c.status === "past_due" && "selected"}>
                        Past due
                      </option>
                    </select>
                  </td>
                  <td className="p-4">
                    <span className="font-medium text-slate-700">{c.userCount}</span>
                    {c.plan === "starter" && c.userCount > 10 && (
                      <span className="text-xs text-destructive ml-2">⚠️ over limit</span>
                    )}
                  </td>
                  <td className="p-4">
                    <button
                      className="btn-primary text-sm px-3 py-1.5"
                      disabled={!editing.has(c.id) || saving}
                      onClick={() => handleSave(c.id)}
                    >
                      {saving && editing.size > 0 ? "Saving…" : "Save"}
                    </button>
                    {editing.has(c.id) && (
                      <button
                        className="btn-secondary text-sm px-3 py-1.5"
                        onClick={() => editing.delete(c.id)}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing.size > 0 && (
        <div className="mt-4 p-4 border rounded bg-slate-50">
          <p className="text-sm text-slate-600">
            {saving ? "Saving changes…" : "Changes for " + editing.size + " company" + (editing.size > 1 ? "s" : "") + " are pending."}
          </p>
        </div>
      )}
    </div>
  );
}