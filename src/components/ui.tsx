"use client";

import { ReactNode } from "react";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
  paid: "bg-blue-100 text-blue-800",
  scheduled: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-700",
  draft: "bg-slate-200 text-slate-700",
  final: "bg-emerald-100 text-emerald-800",
  sent: "bg-sky-100 text-sky-800",
  overdue: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLES[status] || "bg-slate-200 text-slate-700"}`}>{status}</span>;
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="card w-full max-w-lg p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none cursor-pointer">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Alert({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  const cls =
    kind === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <div className={`rounded-lg border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

/** Inline validation message under a form field. */
export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="field-error">{msg}</p>;
}

/** Input class with red border when the field has a validation error. */
export function inputCls(err?: string): string {
  return err ? "input input-invalid" : "input";
}

export async function api<T = Record<string, unknown>>(
  url: string,
  options?: RequestInit & { json?: unknown }
): Promise<T> {
  const opts: RequestInit = { ...options };
  if (options?.json !== undefined) {
    opts.body = JSON.stringify(options.json);
    opts.headers = { "Content-Type": "application/json", ...options.headers };
  }
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}
