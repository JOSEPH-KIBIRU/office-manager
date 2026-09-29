"use client";

import { useEffect, useState, FormEvent } from "react";
import { PageHeader, Alert, FieldError, inputCls, Modal, ConfirmDialog, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { DepartmentRow, DepartmentEmployee, Role } from "@/lib/types";

const ROLE_SHORT: Record<Role, string> = {
  admin: "Admin",
  secretary: "Secretary",
  manager: "Manager",
  employee: "Employee",
  super_admin: "",
};

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [employees, setEmployees] = useState<DepartmentEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  // Create department
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<{ name?: string }>({});

  // Rename department
  const [renaming, setRenaming] = useState<DepartmentRow | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameErrors, setRenameErrors] = useState<{ name?: string }>({});

  // View a department's members
  const [viewing, setViewing] = useState<DepartmentRow | null>(null);
  const [assignTo, setAssignTo] = useState("");

  // Delete department
  const [deleting, setDeleting] = useState<DepartmentRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ departments: DepartmentRow[]; employees: DepartmentEmployee[] }>(
        "/api/departments"
      );
      setDepartments(data.departments);
      setEmployees(data.employees);
      setViewing((current) => {
        if (!current) return null;
        return data.departments.find((d) => d.id === current.id) ?? current;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load departments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function clearError(set: (p: any) => void) {
    set((p: any) => ({ ...p, name: undefined }));
  }

  async function submitNew(e: FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) {
      setErrors({ name: "Department name is required" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/departments", { method: "POST", json: { name: value } });
      toast.success("Department created.");
      setShowNew(false);
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create department");
    } finally {
      setBusy(false);
    }
  }

  async function submitRename(e: FormEvent) {
    e.preventDefault();
    if (!renaming) return;
    const value = renameName.trim();
    if (!value) {
      setRenameErrors({ name: "Department name is required" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/departments/${renaming.id}`, { method: "PATCH", json: { name: value } });
      toast.success("Department renamed.");
      setRenaming(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename department");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    const dept = deleting;
    if (!dept) return;
    setDeleteBusy(true);
    setError(null);
    try {
      await api(`/api/departments/${dept.id}`, { method: "DELETE" });
      toast.success(`Department "${dept.name}" deleted. Employees unassigned.`);
      setDeleting(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete department");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function allocate(userId: string, departmentId: string) {
    setError(null);
    try {
      await api(`/api/users/${userId}`, {
        method: "PATCH",
        json: { department_id: departmentId || null },
      });
      toast.success(
        departmentId ? "Employee assigned to department." : "Employee unassigned."
      );
      setAssignTo("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update assignment");
    }
  }

  async function openView(d: DepartmentRow) {
    setViewing(d);
    setAssignTo("");
  }

  const todos = employees.filter((e) => !e.departmentId);

  return (
    <>
      <PageHeader
        title="Departments"
        subtitle="Organize your team into departments. View each department to see its members and allocate employees."
        action={
          <button className="btn-primary" onClick={() => { setName(""); setErrors({}); setShowNew(true); }}>
            + New department
          </button>
        }
      />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading departments…</div>
        ) : departments.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            No departments yet. Create your first department to start organizing your team.
          </div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Department</th>
                <th>Members</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id}>
                  <td className="font-semibold text-slate-900">{d.name}</td>
                  <td>
                    <span className="badge bg-blue-100 text-blue-800">
                      {d.memberCount} member{d.memberCount === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td className="text-slate-500">{d.createdAt}</td>
                  <td className="space-x-2 whitespace-nowrap text-right">
                    <button className="btn-primary btn-xs" onClick={() => openView(d)}>
                      View & manage
                    </button>
                    <button
                      className="btn-secondary btn-xs"
                      onClick={() => { setRenaming(d); setRenameName(d.name); setRenameErrors({}); }}
                    >
                      Rename
                    </button>
                    <button
                      className="btn-secondary btn-xs text-red-600"
                      onClick={() => setDeleting(d)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <Modal title="New department" onClose={() => setShowNew(false)}>
          <form onSubmit={submitNew} className="space-y-3">
            <div>
              <label className="label" htmlFor="dept-name">Department name</label>
              <input
                id="dept-name"
                className={inputCls(errors.name)}
                value={name}
                onChange={(e) => { setName(e.target.value); clearError(setErrors); }}
                placeholder="e.g. Finance, Human Resources, IT"
                required autoFocus
              />
              <FieldError msg={errors.name} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Creating…" : "Create department"}
            </button>
          </form>
        </Modal>
      )}

      {renaming && (
        <Modal title={`Rename "${renaming.name}"`} onClose={() => setRenaming(null)}>
          <form onSubmit={submitRename} className="space-y-3">
            <div>
              <label className="label" htmlFor="dept-rename">Department name</label>
              <input
                id="dept-rename"
                className={inputCls(renameErrors.name)}
                value={renameName}
                onChange={(e) => { setRenameName(e.target.value); clearError(setRenameErrors); }}
                required autoFocus
              />
              <FieldError msg={renameErrors.name} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Saving…" : "Save name"}
            </button>
          </form>
        </Modal>
      )}

      {viewing && (
        <Modal title={viewing.name} onClose={() => setViewing(null)}>
          <p className="mb-3 text-sm text-slate-500">
            {viewing.memberCount} member{viewing.memberCount === 1 ? "" : "s"} in this department.
          </p>

          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Members</p>
          {viewing.members.length === 0 ? (
            <p className="mb-4 rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
              No employees assigned yet. Use "Assign an employee" below to add someone.
            </p>
          ) : (
            <ul className="mb-4 space-y-1.5">
              {viewing.members.map((m) => (
                <li key={m.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-800">
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{m.name}</span>
                  <span className="badge bg-slate-100 text-slate-600">{ROLE_SHORT[m.role]}</span>
                  <button
                    className="btn-secondary btn-xs text-red-600"
                    onClick={() => allocate(m.id, "")}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Assign an unassigned employee
          </p>
          <div className="flex items-center gap-2">
            <select
              className="input flex-1"
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
            >
              <option value="" disabled>Choose an employee…</option>
              {todos.map((e) => (
                <option key={e.id} value={e.id}>{e.name} ({ROLE_SHORT[e.role] || e.role})</option>
              ))}
            </select>
            <button
              className="btn-primary"
              disabled={!assignTo}
              onClick={() => assignTo && allocate(assignTo, viewing.id)}
            >
              Add
            </button>
          </div>
          {todos.length === 0 && (
            <p className="mt-2 text-xs text-slate-400">
              Everyone is currently assigned to a department.
            </p>
          )}
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete department"
        message={
          <span>
            Delete <strong>{deleting?.name}</strong>? Any employees assigned to it will be unassigned
            (no staff will be removed).
          </span>
        }
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}