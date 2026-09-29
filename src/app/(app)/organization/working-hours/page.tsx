"use client";

import { useState, FormEvent } from "react";
import { PageHeader, Alert } from "@/components/ui";
import OrgSectionNav from "@/components/org/OrgSectionNav";
import { useOrgSettings, OrgNumberField, OrgSaveBar } from "@/components/org/useOrgSettings";

const WORK_FIELDS = ["workingDays", "workStartTime", "workEndTime", "graceMinutes"] as const;

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export default function WorkingHoursPage() {
  const { draft, set, setNumber, save, loading, busy, saved, error } = useOrgSettings();
  const days = (draft.workingDays as number[]) ?? [1, 2, 3, 4, 5];

  function toggleDay(day: number) {
    set("workingDays", (
      days.includes(day)
        ? days.length === 1
          ? days
          : days.filter((d) => d !== day)
        : [...days, day].sort((a, b) => a - b)
    ) as never);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Working hours"
        subtitle="Sets which days count as working days and what hours the attendance clock expects."
      />

      <OrgSectionNav />

      {error && <Alert kind="error">{error}</Alert>}
      {loading && <p className="text-sm text-slate-500">Loading working hours…</p>}

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void save(WORK_FIELDS, "Working hours");
        }}
        className="card max-w-2xl space-y-5 p-6"
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Working days</h3>
          <p className="mb-3 mt-1 text-xs text-slate-500">
            Leave is deducted in <b>actual working days</b> — selected weekdays only, excluding weekends and
            the public holidays configured in the last tab.
          </p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <button
                type="button"
                key={d.value}
                onClick={() => toggleDay(d.value)}
                aria-pressed={days.includes(d.value)}
                className={`rounded-lg border px-3.5 py-1.5 text-sm font-medium transition ${
                  days.includes(d.value)
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">{days.length} working day(s) selected.</p>
        </div>

        <div className="border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold text-slate-900">Daily hours</h3>
          <p className="mb-3 mt-1 text-xs text-slate-500">
            Used by the attendance clock. Clock-in before the start time counts as early, and up to the grace
            period after it is not marked late.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Work starts</label>
              <input
                type="time"
                className="input"
                value={String(draft.workStartTime ?? "08:00")}
                onChange={(e) => set("workStartTime", e.target.value as never)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Work ends</label>
              <input
                type="time"
                className="input"
                value={String(draft.workEndTime ?? "17:00")}
                onChange={(e) => set("workEndTime", e.target.value as never)}
              />
            </div>
          </div>
          <div className="mt-4">
            <OrgNumberField
              label="Grace period (minutes)"
              field="graceMinutes"
              draft={draft}
              setNumber={setNumber}
              min={0}
              max={120}
              hint="Late arrivals within this window are not flagged as late."
            />
          </div>
        </div>

        <OrgSaveBar busy={busy} saved={saved} />
      </form>
    </div>
  );
}
