"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/ui";

/**
 * Effective module permissions for the signed-in user (from /api/permissions/mine).
 * Use `can(<module key>)` to gate UI on a granted module/action instead of a
 * hardcoded role. While loading, `modules` is null and `can` returns false; use
 * it alongside the session role for immediate affordances (e.g. `isAdmin || can(...)`).
 */
export function usePermissions() {
  const [modules, setModules] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;
    api<{ modules: string[] }>("/api/permissions/mine")
      .then((d) => {
        if (active) setModules(Array.isArray(d.modules) ? d.modules : []);
      })
      .catch(() => {
        if (active) setModules([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const can = (module: string) => Array.isArray(modules) && modules.includes(module);
  return { modules, can };
}
