"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import Spinner from "@/components/Spinner";

const ROLE_BADGE: Record<Role, string> = {
  admin: "bg-blue-100 text-blue-700",
  secretary: "bg-amber-100 text-amber-700",
  manager: "bg-emerald-100 text-emerald-700",
  employee: "bg-slate-100 text-slate-600",
  super_admin: "bg-violet-100 text-violet-700",
};

export default function UserMenu({
  name,
  role,
  compact = false,
  dark = false,
}: {
  name: string;
  role: Role;
  compact?: boolean;
  dark?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {
      /* still navigate home even if the network call hiccups */
    }
    router.replace("/");
    router.refresh();
  }

  const signOutContent = busy ? (
    <>
      <Spinner className="h-3.5 w-3.5" />
      Signing out…
    </>
  ) : (
    "Sign out"
  );

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <span
          className={`hidden rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:inline-block ${ROLE_BADGE[role]}`}
        >
          {ROLE_LABELS[role]}
        </span>
        <button
          onClick={logout}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
            dark
              ? "border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
              : "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
          }`}
          title="Sign out"
        >
          {signOutContent}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right leading-tight md:block">
        <p className="text-sm font-semibold text-slate-800">{name}</p>
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ROLE_BADGE[role]}`}
        >
          {ROLE_LABELS[role]}
        </span>
      </div>
      <button
        onClick={logout}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
        title="Sign out"
      >
        {signOutContent}
      </button>
    </div>
  );
}
