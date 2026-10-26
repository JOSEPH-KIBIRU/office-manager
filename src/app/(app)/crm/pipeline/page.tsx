"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import { PageHeader, Alert, Modal, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePermissions } from "@/components/usePermissions";

interface Pipeline {
  _id: string;
  name: string;
  isDefault: boolean;
  active: boolean;
}

interface Stage {
  _id: string;
  pipelineId: string;
  name: string;
  order: number;
  probability?: number;
  isWon: boolean;
  isLost: boolean;
}

const EMPTY_PIPELINE = { name: "", isDefault: false };
const EMPTY_STAGE = { name: "", probability: "", isWon: false, isLost: false };

export default function PipelinePage() {
  const toast = useToast();
  const { modules, can } = usePermissions();

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [activeId, setActiveId] = useState("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [pipelineForm, setPipelineForm] = useState(EMPTY_PIPELINE);
  const [pipelineBusy, setPipelineBusy] = useState(false);

  const [stageOpen, setStageOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [stageForm, setStageForm] = useState(EMPTY_STAGE);
  const [stageBusy, setStageBusy] = useState(false);

  const refresh = useCallback(
    async (preferredId?: string) => {
      try {
        const data = await api<{ pipelines: Pipeline[] }>("/api/crm/pipelines");
        setPipelines(data.pipelines);
        let id = preferredId ?? activeId;
        if (!id || !data.pipelines.some((p) => p._id === id)) {
          id = data.pipelines.find((p) => p.isDefault)?._id ?? data.pipelines[0]?._id ?? "";
        }
        setActiveId(id);
        if (id) {
          const st = await api<{ stages: Stage[] }>(`/api/crm/pipelines/${id}/stages`);
          setStages(st.stages);
        } else {
          setStages([]);
        }
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load pipeline");
      } finally {
        setLoading(false);
      }
    },
    [activeId]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const active = pipelines.find((p) => p._id === activeId) ?? null;

  function openNewPipeline() {
    setEditingPipeline(null);
    setPipelineForm(EMPTY_PIPELINE);
    setPipelineOpen(true);
  }
  function openEditPipeline(p: Pipeline) {
    setEditingPipeline(p);
    setPipelineForm({ name: p.name, isDefault: p.isDefault });
    setPipelineOpen(true);
  }

  async function savePipeline(e: FormEvent) {
    e.preventDefault();
    if (!pipelineForm.name.trim()) {
      toast.error("Pipeline name is required");
      return;
    }
    setPipelineBusy(true);
    try {
      if (editingPipeline) {
        await api(`/api/crm/pipelines/${editingPipeline._id}`, { method: "PATCH", json: pipelineForm });
        toast.success("Pipeline saved");
        setPipelineOpen(false);
        await refresh(editingPipeline._id);
      } else {
        const res = await api<{ id: string }>("/api/crm/pipelines", { method: "POST", json: pipelineForm });
        toast.success("Pipeline created");
        setPipelineOpen(false);
        await refresh(res.id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save pipeline");
    } finally {
      setPipelineBusy(false);
    }
  }

  async function removePipeline(p: Pipeline) {
    if (!confirm(`Delete pipeline "${p.name}"? Its stages are removed (only allowed when it has no deals).`)) return;
    try {
      await api(`/api/crm/pipelines/${p._id}`, { method: "DELETE" });
      toast.success("Pipeline deleted");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete pipeline");
    }
  }

  function openNewStage() {
    setEditingStage(null);
    setStageForm(EMPTY_STAGE);
    setStageOpen(true);
  }
  function openEditStage(s: Stage) {
    setEditingStage(s);
    setStageForm({
      name: s.name,
      probability: s.probability != null ? String(s.probability) : "",
      isWon: s.isWon,
      isLost: s.isLost,
    });
    setStageOpen(true);
  }

  async function saveStage(e: FormEvent) {
    e.preventDefault();
    if (!stageForm.name.trim()) {
      toast.error("Stage name is required");
      return;
    }
    const payload = {
      name: stageForm.name,
      probability: stageForm.probability === "" ? undefined : Number(stageForm.probability),
      isWon: stageForm.isWon,
      isLost: stageForm.isLost,
    };
    setStageBusy(true);
    try {
      if (editingStage) {
        await api(`/api/crm/stages/${editingStage._id}`, { method: "PATCH", json: payload });
        toast.success("Stage saved");
      } else {
        await api(`/api/crm/pipelines/${activeId}/stages`, { method: "POST", json: payload });
        toast.success("Stage added");
      }
      setStageOpen(false);
      await refresh(activeId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save stage");
    } finally {
      setStageBusy(false);
    }
  }

  async function removeStage(s: Stage) {
    if (!confirm(`Delete stage "${s.name}"?`)) return;
    try {
      await api(`/api/crm/stages/${s._id}`, { method: "DELETE" });
      toast.success("Stage deleted");
      await refresh(activeId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete stage");
    }
  }

  async function moveStage(s: Stage, dir: "up" | "down") {
    const idx = stages.findIndex((x) => x._id === s._id);
    const other = stages[dir === "up" ? idx - 1 : idx + 1];
    if (!other) return;
    try {
      await Promise.all([
        api(`/api/crm/stages/${s._id}`, { method: "PATCH", json: { order: other.order } }),
        api(`/api/crm/stages/${other._id}`, { method: "PATCH", json: { order: s.order } }),
      ]);
      await refresh(activeId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reorder stages");
    }
  }

  if (Array.isArray(modules) && !can("crm-pipeline")) {
    return (
      <>
        <PageHeader title="Pipeline" />
        <Alert kind="error">You do not have access to CRM pipelines.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Pipeline"
        subtitle="Configure your sales pipelines and the stages deals move through."
        action={<button className="btn-primary" onClick={openNewPipeline}>+ New pipeline</button>}
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      {loading && <p className="text-sm text-slate-500">Loading pipelines…</p>}

      {!loading && pipelines.length === 0 && (
        <div className="card p-6">
          <p className="text-sm text-slate-600">No pipelines yet. Create one to start tracking deals.</p>
        </div>
      )}

      {pipelines.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {pipelines.map((p) => (
              <button
                key={p._id}
                onClick={() => setActiveId(p._id)}
                className={
                  p._id === activeId
                    ? "rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white"
                    : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                }
              >
                {p.name}
                {p.isDefault && <span className="ml-1 text-[10px] uppercase opacity-70">default</span>}
              </button>
            ))}
          </div>

          {active && (
            <div className="card mb-6 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-700">{active.name}</h2>
                  <p className="text-xs text-slate-500">
                    {active.isDefault ? "Default pipeline · " : ""}
                    {active.active ? "Active" : "Inactive"} · {stages.length} stage(s)
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary px-3 py-1.5 text-sm" onClick={() => openEditPipeline(active)}>Edit pipeline</button>
                  <button className="btn-danger px-3 py-1.5 text-sm" onClick={() => removePipeline(active)}>Delete</button>
                </div>
              </div>
            </div>
          )}

          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-600">Stages</h2>
              <button className="btn-secondary px-3 py-1.5 text-sm" onClick={openNewStage} disabled={!activeId}>+ Add stage</button>
            </div>
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  <th>Stage</th>
                  <th className="text-right">Probability</th>
                  <th>Type</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stages.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-sm text-slate-500">No stages yet. Add the first stage.</td></tr>
                )}
                {stages.map((s, i) => (
                  <tr key={s._id}>
                    <td className="text-slate-400">{i + 1}</td>
                    <td className="font-medium">{s.name}</td>
                    <td className="text-right">{s.probability != null ? `${s.probability}%` : "—"}</td>
                    <td>
                      {s.isWon ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Won</span>
                      ) : s.isLost ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Lost</span>
                      ) : (
                        <span className="text-xs text-slate-400">Open</span>
                      )}
                    </td>
                    <td className="space-x-1.5 whitespace-nowrap text-right">
                      <button className="btn-secondary px-2 py-1 text-xs" onClick={() => moveStage(s, "up")} disabled={i === 0}>↑</button>
                      <button className="btn-secondary px-2 py-1 text-xs" onClick={() => moveStage(s, "down")} disabled={i === stages.length - 1}>↓</button>
                      <button className="btn-secondary px-2 py-1 text-xs" onClick={() => openEditStage(s)}>Edit</button>
                      <button className="btn-danger px-2 py-1 text-xs" onClick={() => removeStage(s)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-slate-500">The deals board (kanban by stage) is the next step.</p>
        </>
      )}

      {pipelineOpen && (
        <Modal title={editingPipeline ? "Edit pipeline" : "New pipeline"} onClose={() => setPipelineOpen(false)}>
          <form onSubmit={savePipeline} className="space-y-3">
            <div>
              <label className="label">Pipeline name</label>
              <input className="input" value={pipelineForm.name} onChange={(e) => setPipelineForm((p) => ({ ...p, name: e.target.value }))} required autoFocus />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4" checked={pipelineForm.isDefault} onChange={(e) => setPipelineForm((p) => ({ ...p, isDefault: e.target.checked }))} />
              Make this the default pipeline
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setPipelineOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={pipelineBusy}>{pipelineBusy ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}

      {stageOpen && (
        <Modal title={editingStage ? "Edit stage" : "New stage"} onClose={() => setStageOpen(false)}>
          <form onSubmit={saveStage} className="space-y-3">
            <div>
              <label className="label">Stage name</label>
              <input className="input" value={stageForm.name} onChange={(e) => setStageForm((p) => ({ ...p, name: e.target.value }))} required autoFocus />
            </div>
            <div>
              <label className="label">Probability (%)</label>
              <input type="number" min={0} max={100} className="input" value={stageForm.probability} onChange={(e) => setStageForm((p) => ({ ...p, probability: e.target.value }))} placeholder="e.g. 50" />
            </div>
            <div className="flex gap-5 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" checked={stageForm.isWon} onChange={(e) => setStageForm((p) => ({ ...p, isWon: e.target.checked, isLost: e.target.checked ? false : p.isLost }))} />
                Won stage
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" checked={stageForm.isLost} onChange={(e) => setStageForm((p) => ({ ...p, isLost: e.target.checked, isWon: e.target.checked ? false : p.isWon }))} />
                Lost stage
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setStageOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={stageBusy}>{stageBusy ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
