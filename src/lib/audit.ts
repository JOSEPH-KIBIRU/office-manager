import "server-only";
import { cx, secret, api } from "./convex";
import type { SessionPayload } from "./types";

/**
 * Record an audit entry from the Next.js layer. The actor identity is taken
 * from the authenticated session so entries are always correctly attributed.
 */
export async function recordAudit(
  session: SessionPayload,
  input: {
    action: string;
    module: string;
    summary: string;
    targetType?: string;
    targetId?: string;
    metadata?: unknown;
  },
  ip?: string | null,
  orgIdOverride?: string
): Promise<void> {
  try {
    await cx().mutation(api.audit.record, {
      secret: secret(),
      orgId: (orgIdOverride ?? session.orgId) as never,
      actorId: (session.id as never) || undefined,
      actorName: session.name,
      actorRole: session.role,
      action: input.action,
      module: input.module,
      targetType: input.targetType,
      targetId: input.targetId,
      summary: input.summary,
      metadata: input.metadata,
      ip: ip ?? undefined,
    });
  } catch (e) {
    // Auditing must never break the primary action.
    console.error("[audit] failed to record entry:", e);
  }
}
