"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, StatusBadge, Modal, Alert, FieldError, inputCls, api } from "@/components/ui";
import { validate, required, pastOrToday, type Errors } from "@/lib/validation";
import type { MinuteRow } from "@/lib/types";

export default function MinutesPage() {
  const router = useRouter();
  const [minutes, setMinutes] = useState<MinuteRow[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [attendees, setAttendees] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  function clearError(field: string) {
    setErrors((p) => ({ ...p, [field]: undefined }));
  }

  async function load() {
    try {
      const data = await api<{ minutes: MinuteRow[] }>("/api/minutes");
      setMinutes(data.minutes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load minutes");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const errs = validate({ title, meetingDate }, {
      title: [required("Title")],
      meetingDate: meetingDate ? [pastOrToday("Meeting date")] : [],
    });
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setBusy(false);
      return;
    }
    setErrors({});
    try {
      const data = await api<{ minute: MinuteRow }>("/api/minutes", {
        method: "POST",
        json: { title, meeting_date: meetingDate || null, attendees },
      });
      router.push(`/minutes/${data.minute.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete these minutes?")) return;
    try {
      await api(`/api/minutes/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <>
      <PageHeader
        title="Minutes"
        subtitle="Write minutes from rough points — or let AI draft them for you."
        action={<button className="btn-primary" onClick={() => setShowNew(true)}>+ New minutes</button>}
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Title</th>
              <th>Meeting date</th>
              <th>Status</th>
              <th>Source</th>
              <th>Author</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {minutes.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">No minutes recorded yet.</td></tr>
            )}
            {minutes.map((m) => (
              <tr key={m.id}>
                <td className="font-medium">{m.title}</td>
                <td>{m.meeting_date ?? "—"}</td>
                <td><StatusBadge status={m.status} /></td>
                <td>
                  {m.file_name && m.file_path ? (
                    <a href={`/api/files/${m.file_path}`} className="text-blue-700 hover:underline">📎 {m.file_name}</a>
                  ) : (
                    <span className="text-slate-400">{m.ai_generated ? "AI-assisted" : "Typed"}</span>
                  )}
                </td>
                <td>{m.author_name}</td>
                <td className="space-x-2 whitespace-nowrap text-right">
                  <a href={`/minutes/${m.id}`} className="btn-secondary px-2.5 py-1 text-xs">Open</a>
                  <button onClick={() => remove(m.id)} className="btn-secondary px-2.5 py-1 text-xs text-red-600">Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && (
        <Modal title="New minutes" onClose={() => setShowNew(false)}>
          <form onSubmit={create} className="space-y-3">
            <div>
              <label className="label">Title</label>
              <input className={inputCls(errors.title)} value={title}
                onChange={(e) => { setTitle(e.target.value); clearError("title"); }}
                placeholder="e.g. Staff Meeting — August 2026" required autoFocus />
              <FieldError msg={errors.title} />
            </div>
            <div>
              <label className="label">Meeting date</label>
              <input type="date" className={inputCls(errors.meetingDate)} value={meetingDate}
                onChange={(e) => { setMeetingDate(e.target.value); clearError("meetingDate"); }} />
              <FieldError msg={errors.meetingDate} />
            </div>
            <div>
              <label className="label">Attendees</label>
              <textarea className="input min-h-16" value={attendees} onChange={(e) => setAttendees(e.target.value)}
                placeholder="Names of members present, one per line" />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Creating…" : "Create & open editor"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
