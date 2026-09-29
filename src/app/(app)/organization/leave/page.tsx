"use client";

import { useState, FormEvent } from "react";
import { PageHeader, Alert } from "@/components/ui";
import OrgSectionNav from "@/components/org/OrgSectionNav";
import { useOrgSettings, OrgNumberField, OrgSaveBar } from "@/components/org/useOrgSettings";

const LEAVE_FIELDS = ["leaveEntitlement", "leaveCarryOverMax", "leaveEncashment"] as const;

export default function LeavePolicyPage() {
  const { draft, set, setNumber, save, loading, busy, saved, error } = useOrgSettings();
  const entitlement = Number(draft.leaveEntitlement) || 0;
  const carryCap = Number(draft.leaveCarryOverMax) || 0;
  const encash = !!draft.leaveEncashment;
  const maxEncashable = Math.max(0, entitlement - carryCap);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave policy"
        subtitle="Applied at the start of each year to every active employee."
      />

      <OrgSectionNav />

      {error && <Alert kind="error">{error}</Alert>}
      {loading && <p className="text-sm text-slate-500">Loading leave policy…</p>}

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void save(LEAVE_FIELDS, "Leave policy");
        }}
        className="card max-w-2xl space-y-5 p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OrgNumberField
            label="Annual entitlement (days)"
            field="leaveEntitlement"
            draft={draft}
            setNumber={setNumber}
            min={0}
            max={365}
            hint="Days granted to each employee each year."
          />
          <OrgNumberField
            label="Carry-over cap (days)"
            field="leaveCarryOverMax"
            draft={draft}
            setNumber={setNumber}
            min={0}
            max={365}
            hint="Unused days up to this cap roll into the new year."
          />
        </div>

        <div className="border-t border-slate-200 pt-5">
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <input
              type="checkbox"
              checked={encash}
              onChange={(e) => set("leaveEncashment", e.target.checked as never)}
              className="mt-0.5 h-4 w-4 accent-indigo-600"
            />
            <span className="text-sm text-slate-700">
              <b>Pay out (encash) unused days above the carry-over cap.</b>
              <span className="mt-1 block text-xs text-slate-500">
                Employees are paid for any balance beyond the cap at year end, and the amount is added to
                payroll as a leave-days payout.
              </span>
            </span>
          </label>

          <div className="mt-3 rounded-lg border border-slate-200 p-4 text-sm">
            {encash ? (
              <>
                <p className="text-slate-700">
                  With a {entitlement}-day entitlement and a {carryCap}-day carry-over cap, up to{" "}
                  <b className="text-slate-900">{maxEncashable} day(s)</b> per employee can be encashed each
                  year.
                </p>
                {maxEncashable === 0 && (
                  <p className="mt-2 text-xs text-amber-700">
                    The cap currently matches or exceeds the entitlement, so nothing will be encashed. Lower the
                    carry-over cap to pay out excess days.
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  After the year-end run, open Payroll and use <b>Prefill leave encashment</b> to add the
                  amounts, then run payroll as usual.
                </p>
              </>
            ) : (
              <p className="text-slate-600">
                Encashment is off. Days above the carry-over cap are simply lost at year end.
              </p>
            )}
          </div>
        </div>

        <OrgSaveBar busy={busy} saved={saved} />
      </form>
    </div>
  );
}
