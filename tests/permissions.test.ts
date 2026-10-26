import { describe, it, expect } from "vitest";
import {
  ALL_MODULE_KEYS,
  ACCOUNTING_MODULE_KEYS,
  CRM_MODULE_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  GROUP_ORDER,
  MODULES,
  isBuiltinOrgRole,
  resolveRolePermissions,
} from "@/lib/permissions";

describe("permissions registry", () => {
  it("has unique module keys", () => {
    expect(new Set(ALL_MODULE_KEYS).size).toBe(ALL_MODULE_KEYS.length);
  });

  it("every module belongs to a known group", () => {
    for (const m of MODULES) {
      expect(GROUP_ORDER).toContain(m.group);
    }
  });

  it("bundle constants contain only real module keys", () => {
    for (const key of [...ACCOUNTING_MODULE_KEYS, ...CRM_MODULE_KEYS]) {
      expect(ALL_MODULE_KEYS).toContain(key);
    }
  });

  it("admin resolves to every module", () => {
    expect(resolveRolePermissions("admin", {})).toEqual(ALL_MODULE_KEYS);
    for (const key of CRM_MODULE_KEYS) {
      expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain(key);
    }
  });

  it("a configured role's grants are intersected with known keys", () => {
    const resolved = resolveRolePermissions("employee", {
      employee: ["dashboard", "crm-leads", "not-a-real-key"],
    });
    expect(resolved).toEqual(["dashboard", "crm-leads"]);
  });

  it("recognises built-in vs custom roles", () => {
    expect(isBuiltinOrgRole("admin")).toBe(true);
    expect(isBuiltinOrgRole("sales-rep")).toBe(false);
  });
});
