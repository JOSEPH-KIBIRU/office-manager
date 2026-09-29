"use client";

import { ReactNode, useEffect, useId, useRef } from "react";
import Spinner from "@/components/Spinner";

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Focus the dialog, trap Tab inside it, close on Escape, and restore focus on exit. */
function useDialogA11y(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () =>
      el ? Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null) : [];
    const first = focusables()[0];
    (first ?? el)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (f.length === 0) return;
      const firstEl = f[0];
      const lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, []);

  return ref;
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLES[status] || "bg-slate-200 text-slate-700"}`}>{status.replace(/_/g, " ")}</span>;
}

/** Small inline help affordance — a "?" that reveals an explanation on hover/focus. */
export function HelpTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`Help: ${text}`}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 transition hover:bg-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-[80] mb-2 hidden w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );
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
  const ref = useDialogA11y(onClose);
  const titleId = useId();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="card my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 outline-none"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id={titleId} className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} aria-label="Close dialog" className="text-slate-400 hover:text-slate-600 text-xl leading-none cursor-pointer">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
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
  open: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  submitted: "bg-amber-100 text-amber-800",
  acknowledged: "bg-emerald-100 text-emerald-800",
  reopened: "bg-orange-100 text-orange-700",
};

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

/**
 * Reusable confirmation dialog for destructive operations. Replaces
 * `window.confirm()`. Buttons disable while `busy` is true so the user can't
 * double-submit the destructive action.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={busy ? undefined : onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <div className="mt-2 text-sm leading-relaxed text-slate-600">{message}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center gap-2 ${tone === "danger" ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? (<><Spinner className="h-4 w-4" /> Working…</>) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
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
  const data = (await res.json().catch(() => ({}))) as { error?: string; retryAfterSeconds?: number };
  if (!res.ok) {
    const wait =
      typeof data.retryAfterSeconds === "number"
        ? ` Please try again in about ${data.retryAfterSeconds}s.`
        : "";
    throw new Error((data.error || `Request failed (${res.status})`) + wait);
  }
  return data as T;
}
