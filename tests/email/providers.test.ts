import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getEmailProvider } from "@/lib/email/providers";

beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = "gid";
  process.env.GOOGLE_CLIENT_SECRET = "gsecret";
  process.env.MICROSOFT_CLIENT_ID = "mid";
  process.env.MICROSOFT_CLIENT_SECRET = "msecret";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

function mockFetch(handler: (url: string) => unknown) {
  return vi.fn(async (input: unknown) => {
    const url =
      typeof input === "string" ? input : String((input as { url?: string })?.url ?? input);
    return jsonResponse(handler(url));
  });
}

describe("Gmail provider", () => {
  it("builds a least-privilege OAuth URL", () => {
    const p = getEmailProvider("gmail")!;
    const url = new URL(p.authUrl("https://app.test/cb", "state-1"));
    expect(url.host).toBe("accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("gid");
    expect(url.searchParams.get("state")).toBe("state-1");
    expect(url.searchParams.get("scope")).toContain("gmail.readonly");
    expect(url.searchParams.get("access_type")).toBe("offline");
  });

  it("exchanges and refreshes tokens", async () => {
    const p = getEmailProvider("gmail")!;
    vi.stubGlobal("fetch", mockFetch(() => ({ access_token: "a", refresh_token: "r", expires_in: 3600 })));
    const tokens = await p.exchangeCode("code", "https://app.test/cb");
    expect(tokens.accessToken).toBe("a");
    expect(tokens.refreshToken).toBe("r");
    expect(tokens.expiresAt).toBeGreaterThan(Date.now());
  });

  it("lists and parses message metadata", async () => {
    const p = getEmailProvider("gmail")!;
    vi.stubGlobal(
      "fetch",
      mockFetch((u) => {
        if (u.includes("/messages?")) return { messages: [{ id: "m1" }] };
        if (u.includes("/profile")) return { historyId: "100" };
        if (u.includes("/messages/m1")) {
          return {
            id: "m1",
            threadId: "t1",
            internalDate: "1700000000000",
            snippet: "preview",
            labelIds: ["INBOX"],
            payload: {
              headers: [
                { name: "From", value: "jane@acme.test" },
                { name: "To", value: "me@x.test" },
                { name: "Subject", value: "Hello" },
                { name: "Message-ID", value: "<abc>" },
              ],
            },
          };
        }
        throw new Error(`unexpected url ${u}`);
      })
    );
    const res = await p.listMessages("token", null, 10);
    expect(res.messages).toHaveLength(1);
    expect(res.messages[0].subject).toBe("Hello");
    expect(res.messages[0].from).toBe("jane@acme.test");
    expect(res.messages[0].direction).toBe("inbound");
    expect(res.nextCursor).toBe("100");
  });
});

describe("Outlook provider", () => {
  it("builds a least-privilege OAuth URL", () => {
    const p = getEmailProvider("outlook")!;
    const url = new URL(p.authUrl("https://app.test/cb", "state-2"));
    expect(url.host).toBe("login.microsoftonline.com");
    expect(url.searchParams.get("client_id")).toBe("mid");
    expect(url.searchParams.get("scope")).toContain("Mail.Read");
    expect(url.searchParams.get("scope")).toContain("offline_access");
  });

  it("parses a Graph delta page and keeps the delta link", async () => {
    const p = getEmailProvider("outlook")!;
    vi.stubGlobal(
      "fetch",
      mockFetch(() => ({
        value: [
          {
            id: "g1",
            conversationId: "c1",
            subject: "Hi",
            bodyPreview: "preview",
            from: { emailAddress: { address: "jane@acme.test" } },
            toRecipients: [{ emailAddress: { address: "me@x.test" } }],
            receivedDateTime: "2026-01-01T10:00:00Z",
          },
        ],
        "@odata.deltaLink":
          "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=abc",
      }))
    );
    const res = await p.listMessages("token", null, 10);
    expect(res.messages).toHaveLength(1);
    expect(res.messages[0].subject).toBe("Hi");
    expect(res.messages[0].from).toBe("jane@acme.test");
    expect(res.nextCursor).toContain("deltatoken");
  });
});
