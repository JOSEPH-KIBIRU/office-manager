import "server-only";

export type CalendarProviderId = "google" | "microsoft";

export interface CalendarEventInput {
  title: string;
  description?: string | null;
  location?: string | null;
  allDay: boolean;
  /** All-day: "YYYY-MM-DD" (inclusive start). Timed: ISO 8601 local "YYYY-MM-DDTHH:mm:ss". */
  start: string;
  /** All-day: "YYYY-MM-DD" (exclusive end). Timed: ISO 8601 local. */
  end: string;
  timeZone: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
}

export interface CalendarProvider {
  id: CalendarProviderId;
  label: string;
  configured: boolean;
  authUrl(redirectUri: string, state: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<TokenSet>;
  refresh(refreshToken: string): Promise<TokenSet>;
  getEmail(accessToken: string): Promise<string | null>;
  upsertEvent(accessToken: string, externalEventId: string | null, event: CalendarEventInput): Promise<string>;
  deleteEvent(accessToken: string, externalEventId: string): Promise<void>;
}

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];
const MS_SCOPES = ["offline_access", "Calendars.ReadWrite", "User.Read", "openid", "email"];

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

/* ----------------------------- Google ----------------------------- */

const google: CalendarProvider = {
  id: "google",
  label: "Google Calendar",
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
  async getEmail(accessToken) {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const j = (await res.json()) as { email?: string };
      return j.email ?? null;
    } catch {
      return null;
    }
  },
  async upsertEvent(accessToken, externalEventId, event) {
    const body: Record<string, unknown> = {
      summary: event.title,
      description: event.description || undefined,
      location: event.location || undefined,
    };
    if (event.allDay) {
      body.start = { date: event.start };
      body.end = { date: event.end };
    } else {
      body.start = { dateTime: event.start, timeZone: event.timeZone };
      body.end = { dateTime: event.end, timeZone: event.timeZone };
    }
    const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    const res = await fetch(externalEventId ? `${base}/${encodeURIComponent(externalEventId)}` : base, {
      method: externalEventId ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message || `Google event write failed (${res.status})`);
    if (!json.id) throw new Error("Google event write returned no id");
    return json.id;
  },
  async deleteEvent(accessToken, externalEventId) {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(externalEventId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      throw new Error(`Google event delete failed (${res.status})`);
    }
  },
};

/* --------------------------- Microsoft --------------------------- */

const microsoft: CalendarProvider = {
  id: "microsoft",
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
  async getEmail(accessToken) {
    try {
      const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const j = (await res.json()) as { mail?: string; userPrincipalName?: string };
      return j.mail || j.userPrincipalName || null;
    } catch {
      return null;
    }
  },
  async upsertEvent(accessToken, externalEventId, event) {
    const body: Record<string, unknown> = {
      subject: event.title,
      body: { contentType: "text", content: event.description || "" },
      location: event.location ? { displayName: event.location } : undefined,
      isAllDay: event.allDay,
      start: { dateTime: event.allDay ? `${event.start}T00:00:00` : event.start, timeZone: event.timeZone },
      end: { dateTime: event.allDay ? `${event.end}T00:00:00` : event.end, timeZone: event.timeZone },
    };
    const base = "https://graph.microsoft.com/v1.0/me/events";
    const res = await fetch(externalEventId ? `${base}/${encodeURIComponent(externalEventId)}` : base, {
      method: externalEventId ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message || `Outlook event write failed (${res.status})`);
    if (!json.id) throw new Error("Outlook event write returned no id");
    return json.id;
  },
  async deleteEvent(accessToken, externalEventId) {
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(externalEventId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok && res.status !== 404) throw new Error(`Outlook event delete failed (${res.status})`);
  },
};

export const PROVIDERS: Record<CalendarProviderId, CalendarProvider> = { google, microsoft };

export function getProvider(id: string): CalendarProvider | null {
  return id === "google" || id === "microsoft" ? PROVIDERS[id] : null;
}
