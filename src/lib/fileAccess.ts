import { requirePermission } from "./permissionGuard";

/**
 * Enforce module-level access for an uploaded file.
 *
 * - `logo` is organisation branding and is readable by any signed-in member.
 * - `task` attachments require the tasks module.
 * - `minutes` attachments require the minutes module.
 * - everything else (documents and legacy uploads) requires documents access.
 */
export async function requireFileKindAccess(kind: string | null | undefined): Promise<void> {
  switch (kind) {
    case "logo":
      return;
    case "task":
      await requirePermission("tasks", ["admin", "secretary", "manager", "employee"]);
      return;
    case "minutes":
      await requirePermission("minutes", ["admin", "secretary"]);
      return;
    default:
      await requirePermission("documents", ["admin", "secretary", "manager"]);
  }
}
