import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/permissionGuard", () => ({
  requirePermission: vi.fn(async () => ({})),
}));

import { requirePermission } from "@/lib/permissionGuard";
import { requireFileKindAccess } from "@/lib/fileAccess";

const check = vi.mocked(requirePermission);

beforeEach(() => {
  check.mockClear();
});

describe("file kind access", () => {
  it("allows organisation logos without a module check", async () => {
    await requireFileKindAccess("logo");
    expect(check).not.toHaveBeenCalled();
  });

  it("requires the tasks module for task attachments", async () => {
    await requireFileKindAccess("task");
    expect(check).toHaveBeenCalledWith("tasks", ["admin", "secretary", "manager", "employee"]);
  });

  it("requires the minutes module for minute attachments", async () => {
    await requireFileKindAccess("minutes");
    expect(check).toHaveBeenCalledWith("minutes", ["admin", "secretary"]);
  });

  it("defaults documents and unknown legacy kinds to the documents module", async () => {
    await requireFileKindAccess("other");
    await requireFileKindAccess(undefined);
    expect(check).toHaveBeenNthCalledWith(1, "documents", ["admin", "secretary", "manager"]);
    expect(check).toHaveBeenNthCalledWith(2, "documents", ["admin", "secretary", "manager"]);
  });
});
