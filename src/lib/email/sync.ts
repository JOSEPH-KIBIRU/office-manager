import "server-only";
import { after } from "next/server";
import { cx, secret, api } from "@/lib/convex";
import { decryptToken, encryptToken } from "./crypto";
import { getEmailProvider, type EmailProvider } from "./providers";
import { reviewInboundLeads } from "@/lib/crmLeadAi";

interface ConnLike {
  _id: string;
  orgId: string;
  provider: "gmail" | "outlook";
  accessTokenEnc: string;
  refreshTokenEnc?: string;
  expiresAt: number;
}

async function freshAccessToken(conn: ConnLike, provider: EmailProvider): Promise<string> {
  const access = decryptToken(conn.accessTokenEnc);
  if (conn.expiresAt - Date.now() > 60_000) return access;
  if (!conn.refreshTokenEnc) return access;
  const refreshed = await provider.refresh(decryptToken(conn.refreshTokenEnc));
  await cx().mutation(api.crmEmail.updateConnectionTokens, {
    secret: secret(),
    id: conn._id as never,
    accessTokenEnc: encryptToken(refreshed.accessToken),
    expiresAt: refreshed.expiresAt,
    refreshTokenEnc: refreshed.refreshToken ? encryptToken(refreshed.refreshToken) : undefined,
  });
  return refreshed.accessToken;
}

export async function syncConnection(conn: ConnLike): Promise<{ inserted: number; updated: number }> {
  const provider = getEmailProvider(conn.provider);
  if (!provider) throw new Error(`Unknown email provider: ${conn.provider}`);
  const accessToken = await freshAccessToken(conn, provider);
  const state = await cx().query(api.crmEmail.getSyncState, {
    secret: secret(),
    connectionId: conn._id as never,
  });
  const { messages, nextCursor } = await provider.listMessages(accessToken, state?.cursor ?? null, 25);
  const res = await cx().mutation(api.crmEmail.upsertMessages, {
    secret: secret(),
    orgId: conn.orgId as never,
    connectionId: conn._id as never,
    provider: conn.provider,
    messages: messages as never,
  });
  await cx().mutation(api.crmEmail.upsertSyncState, {
    secret: secret(),
    orgId: conn.orgId as never,
    connectionId: conn._id as never,
    provider: conn.provider,
    cursor: nextCursor ?? state?.cursor ?? undefined,
    lastSyncedAt: Date.now(),
    status: "idle",
  });
  return res;
}

async function markError(conn: ConnLike, message: string) {
  await cx()
    .mutation(api.crmEmail.upsertSyncState, {
      secret: secret(),
      orgId: conn.orgId as never,
      connectionId: conn._id as never,
      provider: conn.provider,
      status: "error",
      error: message,
    })
    .catch(() => {});
  await cx()
    .mutation(api.crmEmail.updateConnectionTokens, {
      secret: secret(),
      id: conn._id as never,
      status: "error",
      lastError: message,
    })
    .catch(() => {});
}

export async function syncConnectionById(id: string): Promise<void> {
  const conn = await cx().query(api.crmEmail.getConnectionById, {
    secret: secret(),
    id: id as never,
  });
  if (!conn) return;
  try {
    await syncConnection(conn as unknown as ConnLike);
  } catch (e) {
    await markError(conn as unknown as ConnLike, e instanceof Error ? e.message : "Sync failed");
  }
}

/** Queue a sync for one connection after the current response (best effort). */
export function queueEmailSync(connectionId: string): void {
  try {
    after(() => {
      void syncConnectionById(connectionId).catch(() => {});
    });
  } catch {
    /* outside a request scope — the scheduled runner will pick it up */
  }
}

export async function processEmailSync(limit = 10): Promise<{
  synced: number;
  failed: number;
  reviewed: number;
  leadsCreated: number;
}> {
  const conns = await cx().query(api.crmEmail.listConnectionsForSync, {
    secret: secret(),
    limit,
  });
  let synced = 0;
  let failed = 0;
  const orgs = new Map<string, string>();
  for (const conn of conns) {
    const orgId = (conn as unknown as { orgId: string }).orgId;
    const userId = (conn as unknown as { userId: string }).userId;
    if (orgId && userId) orgs.set(orgId, userId);
  }
  for (const conn of conns) {
    try {
      await syncConnection(conn as unknown as ConnLike);
      synced += 1;
    } catch (e) {
      failed += 1;
      await markError(conn as unknown as ConnLike, e instanceof Error ? e.message : "Sync failed");
    }
  }
  let reviewed = 0;
  let leadsCreated = 0;
  if (process.env.CRM_AI_AUTO_REVIEW !== "false") {
    const perOrg = Math.min(Math.max(Number(process.env.CRM_AI_AUTO_REVIEW_LIMIT ?? 1), 1), 3);
    for (const [orgId, actorId] of orgs) {
      try {
        const result = await reviewInboundLeads({ orgId, actorId, limit: perOrg });
        reviewed += result.reviewed;
        leadsCreated += result.created;
      } catch {
        /* AI review is best-effort; the sync itself already succeeded */
      }
    }
  }
  return { synced, failed, reviewed, leadsCreated };
}
