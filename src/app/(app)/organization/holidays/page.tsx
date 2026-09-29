"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import { PageHeader, Alert, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import OrgSectionNav from "@/components/org/OrgSectionNav";

interface Holiday {
  id: string;
  date: string;
  name: string;
}

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [genYear, setGenYear] = useState(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const h = await api<{ holidays: Holiday[] }>("/api/holidays");
      setHolidays(h.holidays);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load public holidays");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addHoliday(e: FormEvent) {
    e.preventDefault();
    if (!holidayDate || !holidayName.trim()) return;
    setBusy(true);
    try {
      await api("/api/holidays", { method: "POST", json: { date: holidayDate, name: holidayName } });
      toast.success("Public holiday added");
      setHolidayDate("");
      setHolidayName("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add holiday");
    } finally {
      setBusy(false);
    }
  }

  async function removeHoliday(id: string) {
    try {
      await api(`/api/holidays/${id}`, { method: "DELETE" });
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      toast.success("Holiday removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove holiday");
    }
  }

  async function generateHolidays() {
    setBusy(true);
    try {
      const res = await api<{ added: number; total: number }>("/api/holidays/generate", {
        method: "POST",
        json: { year: genYear },
      });
      toast.success(`Kenya holidays for ${genYear} generated (${res.added} added, ${res.total} total)`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate holidays");
    } finally {
      setBusy(false);
    }
  }

  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Public holidays"
        subtitle="These dates are excluded from the working-day count, so applying for leave over them won’t deduct a day."
      />

      <OrgSectionNav />

      {error && <Alert kind="error">{error}</Alert>}

      <div className="card max-w-2xl space-y-5 p-6">
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
          <div>
            <label className="label">Auto-generate Kenya holidays</label>
            <input
              type="number"
              className="input w-28"
              min={2000}
              max={2100}
              value={genYear}
              onChange={(e) => setGenYear(Number(e.target.value))}
            />
          </div>
          <button type="button" className="btn-primary" onClick={generateHolidays} disabled={busy}>
            {busy ? "Generating…" : `Generate ${genYear}`}
          </button>
          <p className="w-full text-xs text-slate-500">
            Fixed dates + Easter (Good Friday / Easter Monday) + Eid al-Fitr &amp; Eid al-Adha (estimated — editable).
          </p>
        </div>

        <form onSubmit={addHoliday} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} required />
          </div>
          <div className="min-w-[12rem] flex-1">
            <label className="label">Name</label>
            <input className="input" value={holidayName} onChange={(e) => setHolidayName(e.target.value)} placeholder="e.g. Madaraka Day" required />
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Adding…" : "Add holiday"}</button>
        </form>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="table-base">
            <thead>
              <tr><th>Date</th><th>Holiday</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody>
              {sorted.map((h) => (
                <tr key={h.id}>
                  <td>{h.date}</td>
                  <td className="font-medium">{h.name}</td>
                  <td className="text-right">
                    <button onClick={() => removeHoliday(h.id)} className="btn-danger px-2 py-1 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={3} className="py-4 text-center text-sm text-slate-500">No public holidays added yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
