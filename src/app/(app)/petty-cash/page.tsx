"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSession } from "@/components/SessionProvider";
import { PageHeader, StatusBadge, Alert, FieldError, inputCls, api } from "@/components/ui";
import { validate, required, minNum, notInPast, type Errors } from "@/lib/validation";
import type { PettyCashRow } from "@/lib/types";

export default function PettyCashPage() {
  const session = useSession();
  const isAdmin = session.role === "admin";
  const isManager = session.role === "manager" || isAdmin;
  const [rows, setRows] = useState<PettyCashRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [dateNeeded, setDateNeeded] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  function clearError(field: string) {
    setErrors((p) => ({ ...p, [field]: undefined }));
  }

  async function load(scope?: "mine") {
    try {
      const data = await api<{ requests: PettyCashRow[] }>(scope ? "/api/petty-cash?scope=mine" : "/api/petty-cash");
      setRows(data.requests);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load petty cash requests");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const errs = validate({ amount, purpose, dateNeeded }, {
      amount: [required("Amount"), minNum(1, "Amount")],
      purpose: [required("Purpose")],
      dateNeeded: [required("Date needed"), notInPast("Date needed")],
    });
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setBusy(false);
      return;
    }
    setErrors({});
    try {
      await api("/api/petty-cash", { method: "POST", json: { amount: Number(amount), purpose, date_needed: dateNeeded } });
      setAmount("");
      setPurpose("");
      setNotice("Request submitted. The director has been notified.");
      await load("mine");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "approve" | "reject" | "paid") {
    const note = action === "reject" ? prompt("Reason for rejection (optional):") ?? "" : "";
    try {
      await api(`/api/petty-cash/${id}`, { method: "PATCH", json: { action, note: note || undefined } });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  }

  return (
    <>
      <PageHeader title="Office Petty Cash" subtitle="Request small office funds. Approved requests get a printable requisition form." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">New request</h2>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label">Amount (KES)</label>
              <input type="number" min="1" step="0.01" className={inputCls(errors.amount)} value={amount}
                onChange={(e) => { setAmount(e.target.value); clearError("amount"); }} required />
              <FieldError msg={errors.amount} />
            </div>
            <div>
              <label className="label">Purpose</label>
              <textarea className={inputCls(errors.purpose)} value={purpose} placeholder="What will the money be used for?"
                onChange={(e) => { setPurpose(e.target.value); clearError("purpose"); }} required />
              <FieldError msg={errors.purpose} />
            </div>
            <div>
              <label className="label">Date needed</label>
              <input type="date" className={inputCls(errors.dateNeeded)} value={dateNeeded}
                onChange={(e) => { setDateNeeded(e.target.value); clearError("dateNeeded"); }} required />
              <FieldError msg={errors.dateNeeded} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Submitting…" : "Submit request"}
            </button>
          </form>
        </section>

        <section className="lg:col-span-2">
          {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
          {notice && <div className="mb-4"><Alert kind="success">{notice}</Alert></div>}

          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Ref</th>
                  {isAdmin && <th>Requested by</th>}
                  <th>Amount (KES)</th>
                  <th>Purpose</th>
                  <th>Needed by</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={isAdmin ? 7 : 6} className="py-8 text-center text-slate-400">No petty cash requests yet.</td></tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs">{r.requisition_no}</td>
                    {isAdmin && <td className="font-medium">{r.requester_name}</td>}
                    <td>{r.amount.toLocaleString()}</td>
                    <td className="max-w-xs truncate" title={r.purpose}>{r.purpose}</td>
                    <td>{r.date_needed}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="space-x-1.5 whitespace-nowrap text-right">
                      {(isManager || r.requested_by === session.id) && r.status !== "pending" && r.status !== "rejected" && (
                        <a href={`/requisition/petty-cash/${r.id}`} target="_blank" className="btn-secondary px-2 py-1 text-xs">Form</a>
                      )}
                      {isAdmin && r.status === "pending" && (
                        <>
                          <button onClick={() => act(r.id, "approve")} className="btn-success px-2 py-1 text-xs">Approve</button>
                          <button onClick={() => act(r.id, "reject")} className="btn-danger px-2 py-1 text-xs">Reject</button>
                        </>
                      )}
                      {isAdmin && r.status === "approved" && (
                        <button onClick={() => act(r.id, "paid")} className="btn-primary px-2 py-1 text-xs">Mark paid</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
