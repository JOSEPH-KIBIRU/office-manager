import "server-only";

export type EmailProviderId = "gmail" | "outlook";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
}

export interface EmailIdentity {
  email: string | null;
  name?: string | null;
}

export interface EmailSummary {
  providerMessageId: string;
  threadId?: string;
  internetMessageId?: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string[];
  cc?: string[];
  subject?: string;
  snippet?: string;
  receivedAt: number;
  hasAttachments?: boolean;
}

export interface EmailProvider {
  id: EmailProviderId;
  label: string;
  configured: boolean;
  authUrl(redirectUri: string, state: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<TokenSet>;
  refresh(refreshToken: string): Promise<TokenSet>;
  getIdentity(accessToken: string): Promise<EmailIdentity>;
  listMessages(
    accessToken: string,
    cursor: string | null,
    limit: number
  ): Promise<{ messages: EmailSummary[]; nextCursor: string | null }>;
}

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];
const MS_SCOPES = ["offline_access", "Mail.Read", "User.Read", "openid", "email"];

async function postForm(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(json.error_description || json.error || `Token request failed (${res.status})`));
  }
  return json;
}

/* ------------------------------- Gmail ------------------------------- */

function gmailHeader(headers: Array<{ name?: string; value?: string }> | undefined, name: string) {
  return headers?.find((h) => (h.name ?? "").toLowerCase() === name.toLowerCase())?.value ?? undefined;
}
function splitAddresses(value?: string): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

async function gmailGet(accessToken: string, path: string) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail request failed (${res.status})`);
  return (await res.json()) as Record<string, any>;
}

async function gmailMessage(accessToken: string, id: string): Promise<EmailSummary | null> {
  try {
    const msg = await gmailGet(
      accessToken,
      `messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=Date`
    );
    const headers = msg.payload?.headers as Array<{ name?: string; value?: string }> | undefined;
    const labels = (msg.labelIds ?? []) as string[];
    const dateHeader = gmailHeader(headers, "Date");
    return {
      providerMessageId: String(msg.id),
      threadId: msg.threadId ? String(msg.threadId) : undefined,
      internetMessageId: gmailHeader(headers, "Message-ID"),
      direction: labels.includes("SENT") ? "outbound" : "inbound",
      from: gmailHeader(headers, "From") ?? "",
      to: splitAddresses(gmailHeader(headers, "To")),
      cc: splitAddresses(gmailHeader(headers, "Cc")),
      subject: gmailHeader(headers, "Subject"),
      snippet: msg.snippet ? String(msg.snippet) : undefined,
      receivedAt: msg.internalDate ? Number(msg.internalDate) : dateHeader ? Date.parse(dateHeader) : Date.now(),
    };
  } catch {
    return null;
  }
}

const gmail: EmailProvider = {
  id: "gmail",
  label: "Gmail",
  configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  authUrl(redirectUri, state) {
    const p = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_SCOPES.join(" "),
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
  },
  async exchangeCode(code, redirectUri) {
    const json = await postForm("https://oauth2.googleapis.com/token", {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    return {
      accessToken: String(json.access_token),
      refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
      expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000,
      scope: json.scope ? String(json.scope) : undefined,
    };
  },
  async refresh(refreshToken) {
    const json = await postForm("https://oauth2.googleapis.com/token", {
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      grant_type: "refresh_token",
    });
    return {
      accessToken: String(json.access_token),
      refreshToken,
      expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000,
    };
  },
  async getIdentity(accessToken) {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { email: null };
      const j = (await res.json()) as { email?: string; name?: string };
      return { email: j.email ?? null, name: j.name ?? null };
    } catch {
      return { email: null };
    }
  },
  async listMessages(accessToken, cursor, limit) {
    const ids = new Set<string>();
    let nextCursor: string | null = cursor;

    try {
      if (cursor) {
        const page = await gmailGet(
          accessToken,
          `history?startHistoryId=${encodeURIComponent(cursor)}&historyTypes=messageAdded&maxResults=${limit}`
        );
        for (const h of page.history ?? []) {
          for (const m of h.messages ?? []) if (m.id) ids.add(String(m.id));
        }
        if (page.historyId) nextCursor = String(page.historyId);
      } else {
        const page = await gmailGet(accessToken, `messages?maxResults=${limit}&q=-in:chats`);
        for (const m of page.messages ?? []) if (m.id) ids.add(String(m.id));
        const profile = await gmailGet(accessToken, "profile");
        if (profile.historyId) nextCursor = String(profile.historyId);
      }
    } catch {
      // On an invalid/expired history cursor, fall back to the latest profile id.
      try {
        const profile = await gmailGet(accessToken, "profile");
        if (profile.historyId) nextCursor = String(profile.historyId);
      } catch {
        /* ignore */
      }
      return { messages: [], nextCursor };
    }

    const messages: EmailSummary[] = [];
    for (const id of ids) {
      const m = await gmailMessage(accessToken, id);
      if (m) messages.push(m);
    }
    return { messages, nextCursor };
  },
};

/* ----------------------------- Microsoft ----------------------------- */

async function graphGet(accessToken: string, url: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Microsoft Graph request failed (${res.status})`);
  return (await res.json()) as Record<string, any>;
}

const outlook: EmailProvider = {
  id: "outlook",
  label: "Microsoft Outlook",
  configured: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
  authUrl(redirectUri, state) {
    const p = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID || "",
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: MS_SCOPES.join(" "),
      state,
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${p.toString()}`;
  },
  async exchangeCode(code, redirectUri) {
    const json = await postForm("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      code,
      client_id: process.env.MICROSOFT_CLIENT_ID || "",
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: MS_SCOPES.join(" "),
    });
    return {
      accessToken: String(json.access_token),
      refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
      expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000,
      scope: json.scope ? String(json.scope) : undefined,
    };
  },
  async refresh(refreshToken) {
    const json = await postForm("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      refresh_token: refreshToken,
      client_id: process.env.MICROSOFT_CLIENT_ID || "",
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || "",
      grant_type: "refresh_token",
      scope: MS_SCOPES.join(" "),
    });
    return {
      accessToken: String(json.access_token),
      refreshToken: json.refresh_token ? String(json.refresh_token) : refreshToken,
      expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000,
    };
  },
  async getIdentity(accessToken) {
    try {
      const j = await graphGet(accessToken, "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName");
      return { email: j.mail || j.userPrincipalName || null, name: j.displayName ?? null };
    } catch {
      return { email: null };
    }
  },
  async listMessages(accessToken, cursor, limit) {
    const select =
      "$select=id,conversationId,internetMessageId,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments";
    let next: string | null =
      cursor ??
      `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?${select}&$top=${limit}`;
    let delta: string | null = null;
    const items: Record<string, any>[] = [];

    while (next && items.length < limit) {
      const page = await graphGet(accessToken, next);
      for (const m of page.value ?? []) {
        if (!m["@removed"]) items.push(m);
      }
      if (page["@odata.deltaLink"]) {
        delta = String(page["@odata.deltaLink"]);
        next = null;
      } else {
        next = page["@odata.nextLink"] ? String(page["@odata.nextLink"]) : null;
      }
    }

    const messages: EmailSummary[] = items.slice(0, limit).map((m) => ({
      providerMessageId: String(m.id),
      threadId: m.conversationId ? String(m.conversationId) : undefined,
      internetMessageId: m.internetMessageId ? String(m.internetMessageId) : undefined,
      direction: "inbound",
      from: m.from?.emailAddress?.address ? String(m.from.emailAddress.address) : "",
      to: (m.toRecipients ?? []).map((r: any) => String(r?.emailAddress?.address ?? "")).filter(Boolean),
      cc: (m.ccRecipients ?? []).map((r: any) => String(r?.emailAddress?.address ?? "")).filter(Boolean),
      subject: m.subject ? String(m.subject) : undefined,
      snippet: m.bodyPreview ? String(m.bodyPreview) : undefined,
      receivedAt: m.receivedDateTime ? Date.parse(m.receivedDateTime) : Date.now(),
      hasAttachments: Boolean(m.hasAttachments),
    }));

    return { messages, nextCursor: delta ?? cursor };
  },
};

export const EMAIL_PROVIDERS: Record<EmailProviderId, EmailProvider> = { gmail, outlook };

export function getEmailProvider(id: string): EmailProvider | null {
  return id === "gmail" || id === "outlook" ? EMAIL_PROVIDERS[id] : null;
}
