import "server-only";
import { cx, secret, api } from "./convex";
import type { SessionPayload } from "./types";
import type { SubscriptionLike } from "./subscription";

export interface ValidatedSessionUser {
  id: string;
  orgId: string;
  role: string;
  name: string;
  email: string;
  active: boolean;
  sessionVersion: number;
  subscription: SubscriptionLike | null;
}

/**
 * Re-validate a signed session against the database. Rejects when the user is
 * missing, inactive, belongs to another org, or the session version no longer
 * matches (password/role change or deactivation).
 */
export async function getValidatedSessionUser(
  session: SessionPayload | null | undefined
): Promise<ValidatedSessionUser | null> {
  if (!session?.id || !session.orgId) return null;
  try {
    const user = await cx().query(api.auth.validateSession, {
      secret: secret(),
      id: session.id as never,
      orgId: session.orgId as never,
      sessionVersion: session.sessionVersion,
    });
    return (user as ValidatedSessionUser | null) ?? null;
  } catch {
    return null;
  }
}
