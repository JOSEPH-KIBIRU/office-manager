"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSession } from "@/components/SessionProvider";
import { PageHeader, StatusBadge, Modal, Alert, FieldError, inputCls, ConfirmDialog, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import { validate, required, notInPast, type Errors } from "@/lib/validation";

interface Meeting {
  id: string;
  title: string;
  agenda: string | null;
  location: string | null;
  scheduled_at: string;
  attendees: string;
  director_id: string | null;
  director_name: string | null;
  status: string;
  created_by_name: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

function fmtDate(s: string) {
  return new Date(s.replace(" ", "T")).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" });
}

export default function MeetingsPage() {
  const session = useSession();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingStatus, setPendingStatus] = useState<{ id: string; status: string } | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const toast = useToast();

  const isScheduler = session.role === "admin" || session.role === "secretary";

  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState("");
  const [location, setLocation] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [directorId, setDirectorId] = useState("");
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Errors>({});

  function clearError(field: string) {
    setErrors((p) => ({ ...p, [field]: undefined }));
  }

  async function load() {
    setLoading(true);
    try {
      const m = await api<{ meetings: Meeting[] }>("/api/meetings");
      setMeetings(m.meetings);
      // Only schedulers may read the staff directory; others just view meetings.
      if (isScheduler) {
        try {
          const u = await api<{ users: StaffMember[] }>("/api/users");
          setStaff(u.users);
        } catch {
          /* attendee list is optional */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleAttendee(id: string) {
    setAttendeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const errs = validate({ title, scheduledAt }, {
      title: [required("Title")],
      scheduledAt: [required("Date & time"), notInPast("Meeting date")],
    });
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setBusy(false);
      return;
    }
    setErrors({});
    try {
      await api("/api/meetings", {
        method: "POST",
        json: {
          title,
          agenda,
          location,
          scheduled_at: scheduledAt.replace("T", " "),
          attendees: attendeeIds,
          director_id: directorId || null,
        },
      });
      setShowNew(false);
      setTitle("");
      setAgenda("");
      setLocation("");
      setScheduledAt("");
      setAttendeeIds([]);
      toast.success("Meeting scheduled. Invited members have been notified by email and SMS.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setStatusBusy(true);
    try {
      await api(`/api/meetings/${id}`, { method: "PATCH", json: { status } });
      setPendingStatus(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setStatusBusy(false);
    }
  }

  async function remove() {
    const id = deletingId;
    if (!id) return;
    setDeleteBusy(true);
    try {
      await api(`/api/meetings/${id}`, { method: "DELETE" });
      toast.success("Meeting deleted.");
      setDeletingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Meetings"
        subtitle="Schedule board and directors' meetings and notify attendees."
        action={isScheduler ? <button className="btn-primary" onClick={() => setShowNew(true)}>+ Schedule meeting</button> : undefined}
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="space-y-4">
        {loading && <p className="card p-8 text-center text-slate-500">Loading meetings…</p>}
        {!loading && meetings.length === 0 && <p className="card p-8 text-center text-slate-500">No meetings scheduled yet.</p>}
        {!loading && meetings.map((m) => {
          const ids = JSON.parse(m.attendees || "[]") as number[];
          return (
            <div key={m.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{m.title}</h3>
                  <p className="mt-0.5 text-sm text-slate-500">{fmtDate(m.scheduled_at)} · {m.location || "Location TBD"}</p>
                  {m.agenda && <p className="mt-2 max-w-2xl text-sm text-slate-600 whitespace-pre-wrap">{m.agenda}</p>}
                  <p className="mt-2 text-xs text-slate-500">
                    Chair: {m.director_name || "—"} · Attendees invited: {ids.length} · Created by {m.created_by_name}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={m.status} />
                  {isScheduler && m.status === "scheduled" && (
                    <>
                      <button onClick={() => setPendingStatus({ id: m.id, status: "completed" })} className="btn-success btn-xs">Complete</button>
                      <button onClick={() => setPendingStatus({ id: m.id, status: "cancelled" })} className="btn-danger btn-xs">Cancel</button>
                    </>
                  )}
                  {isScheduler && (
                    <a href="/minutes" className="btn-secondary btn-xs">Minutes →</a>
                  )}
                  {isScheduler && (
                    <button onClick={() => setDeletingId(m.id)} className="btn-secondary btn-xs text-red-600">Del</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showNew && (
        <Modal title="Schedule a meeting" onClose={() => setShowNew(false)}>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label" htmlFor="mt-title">Title</label>
              <input id="mt-title" className={inputCls(errors.title)} value={title}
                onChange={(e) => { setTitle(e.target.value); clearError("title"); }}
                placeholder="e.g. Monthly Board Meeting" required />
              <FieldError msg={errors.title} />
            </div>
            <div>
              <label className="label" htmlFor="mt-agenda">Agenda</label>
              <textarea id="mt-agenda" className="input min-h-24" value={agenda} onChange={(e) => setAgenda(e.target.value)}
                placeholder="One item per line…" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="mt-when">Date &amp; time</label>
                <input id="mt-when" type="datetime-local" className={inputCls(errors.scheduledAt)} value={scheduledAt}
                  onChange={(e) => { setScheduledAt(e.target.value); clearError("scheduledAt"); }} required />
                <FieldError msg={errors.scheduledAt} />
              </div>
              <div>
                <label className="label" htmlFor="mt-location">Location</label>
                <input id="mt-location" className="input" value={location} onChange={(e) => setLocation(e.target.value)}
                  placeholder="Boardroom / Google Meet" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="mt-director">Chairing director</label>
              <select id="mt-director" className="input" value={directorId} onChange={(e) => setDirectorId(e.target.value)}>
                <option value="">— None —</option>
                {staff.filter((s) => s.role === "admin").map((s) => (
                  <option key={s.id} value={s.id}>{s.name} (Director)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Invite attendees</label>
              <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {staff.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50">
                    <input type="checkbox" checked={attendeeIds.includes(s.id)} onChange={() => toggleAttendee(s.id)} />
                    {s.name}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">Invited members receive an email and SMS notification.</p>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Scheduling…" : "Schedule & notify"}
            </button>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deletingId}
        title="Delete meeting"
        message="Delete this meeting? This cannot be undone."
        busy={deleteBusy}
        onConfirm={remove}
        onCancel={() => setDeletingId(null)}
      />

      <ConfirmDialog
        open={!!pendingStatus}
        title={pendingStatus?.status === "completed" ? "Mark meeting completed" : "Cancel meeting"}
        message={
          pendingStatus?.status === "completed"
            ? "Mark this meeting as completed?"
            : "Cancel this meeting? This cannot be undone."
        }
        confirmLabel={pendingStatus?.status === "completed" ? "Mark completed" : "Cancel meeting"}
        tone={pendingStatus?.status === "cancelled" ? "danger" : "default"}
        busy={statusBusy}
        onConfirm={() => pendingStatus && setStatus(pendingStatus.id, pendingStatus.status)}
        onCancel={() => setPendingStatus(null)}
      />
    </>
  );
}
