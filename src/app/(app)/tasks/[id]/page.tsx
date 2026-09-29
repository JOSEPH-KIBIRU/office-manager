"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader, Alert, api, inputCls } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useSession } from "@/components/SessionProvider";
import { useUploadThing } from "@/lib/uploadthing";

interface Photo {
  url: string;
  name: string;
}
interface UpdateItem {
  id: string;
  kind: "report" | "comment";
  author_id: string;
  author_name: string;
  description: string | null;
  doing: string | null;
  location: string | null;
  photos: Photo[];
  created_at: string;
}
interface TaskDetail {
  id: string;
  title: string;
  description: string;
  priority: string;
  due_date: string | null;
  status: string;
  created_by: string;
  created_by_name: string;
  assignee_id: string;
  assignee_name: string;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
  remark: string | null;
  created_at: string;
  updated_at: string;
}
interface Data {
  task: TaskDetail;
  updates: UpdateItem[];
  can: { isAssignee: boolean; isCreator: boolean; isAdmin: boolean };
}

const STATUS_BADGE: Record<string, string> = {
  open: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  submitted: "bg-amber-100 text-amber-800",
  acknowledged: "bg-emerald-100 text-emerald-700",
  reopened: "bg-orange-100 text-orange-700",
  cancelled: "bg-slate-200 text-slate-500",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  reopened: "Reopened",
  cancelled: "Cancelled",
};

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const session = useSession();
  const toast = useToast();
  const id = params?.id;

  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // report form
  const [description, setDescription] = useState("");
  const [doing, setDoing] = useState("");
  const [location, setLocation] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const { startUpload, isUploading } = useUploadThing("taskImage", {
    onClientUploadComplete: (res) => {
      setPhotos((prev) => [...prev, ...(res ?? []).map((f) => ({ url: f.ufsUrl, name: f.name }))]);
    },
    onUploadError: (e) => toast.error(e.message),
  });

  // review / comment
  const [remark, setRemark] = useState("");
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setData(await api<Data>(`/api/tasks/${id}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load task");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(payload: Record<string, unknown>, okMsg: string) {
    if (!id) return;
    setBusy(true);
    try {
      await api(`/api/tasks/${id}/action`, { method: "POST", json: payload });
      toast.success(okMsg);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    try {
      await startUpload(files);
    } catch {
      /* onUploadError handles messaging */
    }
  }

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <p className="text-sm text-slate-400">Loading task…</p>;

  const { task, updates, can } = data;
  const isOpen = ["open", "in_progress", "reopened"].includes(task.status);

  return (
    <>
      <PageHeader
        title={task.title}
        subtitle={`Assigned to ${task.assignee_name} · by ${task.created_by_name}`}
        action={
          <div className="flex items-center gap-2">
            <span className={`badge ${STATUS_BADGE[task.status] ?? "bg-slate-100 text-slate-600"}`}>
              {STATUS_LABEL[task.status] ?? task.status}
            </span>
            {(can.isCreator || can.isAdmin) && task.status !== "acknowledged" && task.status !== "cancelled" && (
              <button onClick={() => act({ action: "cancel" }, "Task cancelled.")} disabled={busy} className="btn-danger px-3 py-1.5 text-sm">
                Cancel
              </button>
            )}
            <button onClick={() => router.push("/tasks")} className="btn-secondary px-3 py-1.5 text-sm">Back</button>
          </div>
        }
      />

      {/* Meta */}
      <div className="card mb-4 grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
        <div><p className="text-xs text-slate-400">Priority</p><p className="font-medium capitalize">{task.priority}</p></div>
        <div><p className="text-xs text-slate-400">Due date</p><p className="font-medium">{task.due_date ?? "—"}</p></div>
        <div><p className="text-xs text-slate-400">Created</p><p className="font-medium">{task.created_at}</p></div>
        <div><p className="text-xs text-slate-400">Last activity</p><p className="font-medium">{task.updated_at}</p></div>
      </div>

      <div className="card mb-4 p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Instructions</p>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{task.description || "—"}</p>
        {task.status === "acknowledged" && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <p className="font-semibold">Acknowledged by {task.acknowledged_by_name} on {task.acknowledged_at}</p>
            {task.remark && <p className="mt-1">Remark: {task.remark}</p>}
          </div>
        )}
      </div>

      {/* Assignee actions */}
      {can.isAssignee && isOpen && (
        <div className="card mb-4 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Submit your report</h2>
            {task.status !== "in_progress" && (
              <button onClick={() => act({ action: "start" }, "Task started.")} disabled={busy} className="btn-secondary px-3 py-1.5 text-xs">
                Mark in progress
              </button>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="tr-desc">What did you do? (summary)</label>
              <textarea id="tr-desc" className={inputCls()} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Delivered the documents and got a receipt" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="tr-doing">What were you doing? (quote)</label>
                <input id="tr-doing" className={inputCls()} value={doing} onChange={(e) => setDoing(e.target.value)} placeholder="e.g. Queued at KRA for 2 hours" />
              </div>
              <div>
                <label className="label" htmlFor="tr-location">Where did you visit?</label>
                <input id="tr-location" className={inputCls()} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Times Tower, Nairobi" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="tr-photos">Photos (optional)</label>
              <input id="tr-photos" type="file" accept="image/*" multiple onChange={onPickPhotos} className="block w-full cursor-pointer text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white" />
              {isUploading && <p className="mt-1 text-xs text-slate-400">Uploading…</p>}
              {photos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {photos.map((p) => (
                    <span key={p.url} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={p.name} className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200" />
                      <button type="button" onClick={() => setPhotos((prev) => prev.filter((x) => x.url !== p.url))} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-600 text-[10px] font-bold text-white">✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() =>
                act(
                  {
                    action: "report",
                    description,
                    doing,
                    location,
                    photos,
                  },
                  "Report submitted."
                )
              }
              disabled={busy || isUploading}
              className="btn-primary w-full"
            >
              {busy ? "Submitting…" : "Submit report"}
            </button>
          </div>
        </div>
      )}

      {/* Creator review */}
      {(can.isCreator || can.isAdmin) && (task.status === "submitted" || task.status === "reopened") && (
        <div className="card mb-4 p-5">
          <h2 className="mb-3 font-semibold text-slate-800">Review the report</h2>
          <textarea className={inputCls()} rows={2} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Remark (optional) — e.g. Good work / please redo the bank part" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => act({ action: "acknowledge", remark }, "Task acknowledged.")} disabled={busy} className="btn-success">Acknowledge</button>
            <button onClick={() => act({ action: "reopen", remark }, "Task reopened.")} disabled={busy} className="btn-secondary">Reopen (needs more)</button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="card mb-4 overflow-hidden">
        <p className="border-b border-slate-100 px-5 py-3 font-semibold text-slate-800">Activity</p>
        {updates.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">No reports or comments yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {updates.map((u) => (
              <li key={u.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">
                    {u.author_name}
                    {u.kind === "report" && <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-700">Report</span>}
                  </p>
                  <span className="text-xs text-slate-400">{u.created_at}</span>
                </div>
                {u.description && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{u.description}</p>}
                {(u.doing || u.location) && (
                  <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                    {u.doing && <p><span className="font-medium text-slate-600">Doing:</span> {u.doing}</p>}
                    {u.location && <p><span className="font-medium text-slate-600">Visited:</span> {u.location}</p>}
                  </div>
                )}
                {u.photos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {u.photos.map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={p.url} src={p.url} alt={p.name} className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200" />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Comment */}
      <div className="card p-5">
        <h2 className="mb-2 font-semibold text-slate-800">Add a comment</h2>
        <textarea className={inputCls()} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ask a question or add a note…" />
        <button
          onClick={() => { act({ action: "comment", text: comment }, "Comment added."); setComment(""); }}
          disabled={busy || !comment.trim()}
          className="btn-primary mt-3"
        >
          Send comment
        </button>
      </div>
    </>
  );
}
