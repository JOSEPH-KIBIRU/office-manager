"use client";

import { use, useEffect, useRef, useState } from "react";
import { PageHeader, StatusBadge, Alert, FieldError, inputCls, api } from "@/components/ui";
import { validate, required, pastOrToday, type Errors } from "@/lib/validation";
import type { MinuteRow } from "@/lib/types";

export default function MinutesEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const fileRef = useRef<HTMLInputElement>(null);

  const [m, setM] = useState<MinuteRow | null>(null);
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [attendees, setAttendees] = useState("");
  const [points, setPoints] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  function clearError(field: string) {
    setErrors((p) => ({ ...p, [field]: undefined }));
  }

  useEffect(() => {
    (async () => {
      try {
        const data = await api<{ minute: MinuteRow }>(`/api/minutes/${id}`);
        setM(data.minute);
        setTitle(data.minute.title);
        setMeetingDate(data.minute.meeting_date ?? "");
        setAttendees(data.minute.attendees ?? "");
        setPoints(data.minute.points);
        setContent(data.minute.content);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load minutes");
      }
    })();
  }, [id]);

  async function save(status?: "draft" | "final", aiGenerated = false) {
    setBusy(true);
    setError(null);
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
      const data = await api<{ minute: MinuteRow }>(`/api/minutes/${id}`, {
        method: "PATCH",
        json: { title, meeting_date: meetingDate || null, attendees, points, content, status, ai_generated: aiGenerated },
      });
      setM(data.minute);
      setNotice(`Saved as ${data.minute.status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!points.trim()) return setError("Add some rough points first — the AI turns them into formal minutes.");
    if (!title.trim()) return setError("A title is required.");
    setGenerating(true);
    setError(null);
    setNotice("Generating formal minutes with AI… this may take a few seconds.");
    try {
      const data = await api<{ content: string }>("/api/minutes/generate", {
        method: "POST",
        json: { title, meeting_date: meetingDate || undefined, attendees: attendees || undefined, points },
      });
      setContent(data.content);
      setNotice("AI draft ready. Review and edit before marking final.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function uploadFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/minutes/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      await api(`/api/minutes/${id}`, {
        method: "PATCH",
        json: { file_name: data.file_name, file_path: data.file_path },
      });
      setM((prev) => (prev ? { ...prev, file_name: data.file_name, file_path: data.file_path } : prev));
      setNotice("File attached to these minutes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!m && !error) return <p className="text-slate-500">Loading…</p>;

  return (
    <>
      <PageHeader
        title={title || "Minutes"}
        subtitle={m?.status === "final" ? "These minutes are marked final." : "Draft — edit freely."}
        action={<StatusBadge status={m?.status ?? "draft"} />}
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {notice && <div className="mb-4"><Alert kind="success">{notice}</Alert></div>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Meeting details</h2>
          <div>
            <label className="label" htmlFor="md-title">Title</label>
            <input id="md-title" className={inputCls(errors.title)} value={title}
              onChange={(e) => { setTitle(e.target.value); clearError("title"); }} />
            <FieldError msg={errors.title} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="md-date">Date</label>
              <input id="md-date" type="date" className={inputCls(errors.meetingDate)} value={meetingDate}
                onChange={(e) => { setMeetingDate(e.target.value); clearError("meetingDate"); }} />
              <FieldError msg={errors.meetingDate} />
            </div>
            <div>
              <label className="label" htmlFor="md-attach">Attachment</label>
              <input id="md-attach" ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg" className="input py-1.5"
                onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
              {m?.file_path && (
                <a href={`/api/files/${m.file_path}`} className="mt-1 inline-block text-xs text-blue-700 hover:underline">
                  📎 Download current: {m.file_name}
                </a>
              )}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="md-attendees">Attendees</label>
            <textarea id="md-attendees" className="input min-h-20" value={attendees} onChange={(e) => setAttendees(e.target.value)}
              placeholder="Members present, one per line" />
          </div>

          <hr className="border-slate-100" />
          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="md-points">Rough points</label>
              <button onClick={generate} className="btn-primary px-3 py-1.5 text-xs" disabled={generating}>
                {generating ? "Generating…" : "✨ Generate minutes with AI"}
              </button>
            </div>
            <textarea
              id="md-points"
              className="input min-h-64 font-mono text-xs leading-relaxed"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder={"Jot rough points here, one per line:\n\n• discussed overdue invoices\n• JK to follow up with supplier by Friday\n• office furniture budget approved at 150k"}
            />
          </div>
        </section>

        <section className="card flex flex-col space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Formal minutes</h2>
            <span className="text-xs text-slate-400">{content.length} chars · Markdown</span>
          </div>
          <textarea
            className="input min-h-[28rem] flex-1 font-mono text-sm leading-relaxed"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="The formal minutes will appear here — write manually or generate from your points with AI."
          />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => save("draft")} className="btn-secondary" disabled={busy}>Save draft</button>
            <button onClick={() => save("final")} className="btn-success" disabled={busy}>Mark final</button>
            <a href={`/minutes/${id}/print`} target="_blank" className="btn-secondary ml-auto">Download / print as PDF</a>
            {m?.file_path && (
              <a href={`/api/files/${m.file_path}`} className="btn-secondary">Download attachment</a>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
