"use client";

import { useCallback, useEffect, useRef, useState, FormEvent } from "react";
import { PageHeader, Alert, Modal, api } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usePermissions } from "@/components/usePermissions";

interface Channel {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  kind: "channel" | "dm";
  dmUserId: string | null;
  unreadCount: number;
}
interface Message {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  body: string;
  mentionIds: string[];
  createdAt: number;
  editedAt: number | null;
  deleted: boolean;
  mine: boolean;
}
interface Member { id: string; name: string; role: string; }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fmt(ms: number) {
  return new Date(ms).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderMentions(text: string, mine: boolean) {
  return text.split(/(@[A-Za-z0-9._-]+)/g).map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className={mine ? "font-semibold underline" : "font-semibold text-indigo-600"}>{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function ChatPage() {
  const toast = useToast();
  const { modules, can } = usePermissions();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastRef = useRef(0);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const [showDm, setShowDm] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [dmUserId, setDmUserId] = useState("");
  const [dmBusy, setDmBusy] = useState(false);

  const [mentionSet, setMentionSet] = useState<Set<string>>(new Set());
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const mergeMessages = useCallback((incoming: Message[]) => {
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.id, m] as const));
      for (const m of incoming) map.set(m.id, m);
      return [...map.values()].sort((a, b) => a.createdAt - b.createdAt);
    });
  }, []);

  const loadChannels = useCallback(async (selectId?: string) => {
    try {
      const data = await api<{ channels: Channel[] }>("/api/chat/channels");
      setChannels(data.channels);
      setActiveId((prev) => {
        if (selectId) return selectId;
        if (prev && data.channels.some((c) => c.id === prev)) return prev;
        return data.channels.find((c) => c.isDefault)?.id ?? data.channels[0]?.id ?? "";
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chat");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
    api<{ members: Member[] }>("/api/chat/members")
      .then((d) => setMembers(d.members))
      .catch(() => {});
  }, [loadChannels]);

  // Keep channel unread counts reasonably fresh.
  useEffect(() => {
    const timer = setInterval(() => loadChannels(), 30000);
    return () => clearInterval(timer);
  }, [loadChannels]);

  // Long-poll messages for the active channel (near real-time).
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    lastRef.current = 0;

    const markRead = () =>
      api(`/api/chat/channels/${activeId}/read`, { method: "POST" }).catch(() => {});

    async function loop() {
      while (!cancelled) {
        try {
          const data = await api<{ messages: Message[] }>(
            `/api/chat/channels/${activeId}/messages?after=${lastRef.current}`
          );
          if (cancelled) return;
          if (data.messages.length) {
            mergeMessages(data.messages);
            lastRef.current = Math.max(lastRef.current, ...data.messages.map((m) => m.createdAt));
            void markRead();
          }
        } catch {
          if (cancelled) return;
          await sleep(2000);
        }
      }
    }

    async function initial() {
      try {
        const data = await api<{ messages: Message[]; serverTime?: number }>(
          `/api/chat/channels/${activeId}/messages`
        );
        if (cancelled) return;
        setMessages(data.messages);
        lastRef.current = data.messages.length
          ? data.messages[data.messages.length - 1].createdAt
          : data.serverTime ?? Date.now();
        setMentionSet(new Set());
        setMentionQuery(null);
        setLoading(false);
        await markRead();
        loop();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load messages");
          setLoading(false);
        }
      }
    }

    setLoading(true);
    initial();

    // Periodic full refresh catches edits/deletes (incremental poll only adds).
    const refresh = setInterval(async () => {
      try {
        const data = await api<{ messages: Message[] }>(`/api/chat/channels/${activeId}/messages`);
        if (!cancelled) {
          setMessages(data.messages);
          lastRef.current = data.messages.length
            ? data.messages[data.messages.length - 1].createdAt
            : lastRef.current;
        }
      } catch {
        /* ignore */
      }
    }, 60000);

    return () => {
      cancelled = true;
      clearInterval(refresh);
    };
  }, [activeId, mergeMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activeId]);

  const activeChannel = channels.find((c) => c.id === activeId) ?? null;
  const textChannels = channels.filter((c) => c.kind !== "dm");
  const dms = channels.filter((c) => c.kind === "dm");

  const mentionSuggestions =
    mentionQuery !== null
      ? members
          .filter((m) => {
            const q = mentionQuery.toLowerCase();
            return m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q);
          })
          .slice(0, 6)
      : [];

  function pickMention(m: Member) {
    setBody((prev) => prev.replace(/@([A-Za-z0-9._-]*)$/, `@${m.name} `));
    setMentionSet((prev) => new Set(prev).add(m.id));
    setMentionQuery(null);
    textareaRef.current?.focus();
  }

  function reconcileMentions(text: string): string[] {
    return [...mentionSet].filter((id) => {
      const m = members.find((x) => x.id === id);
      return m ? text.toLowerCase().includes("@" + m.name.toLowerCase()) : false;
    });
  }

  async function submit() {
    const text = body.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    try {
      await api(`/api/chat/channels/${activeId}/messages`, {
        method: "POST",
        json: { body: text, mentionIds: reconcileMentions(text) },
      });
      setBody("");
      setMentionSet(new Set());
      setMentionQuery(null);
      const data = await api<{ messages: Message[] }>(
        `/api/chat/channels/${activeId}/messages?after=${lastRef.current}&wait=0`
      );
      if (data.messages.length) {
        mergeMessages(data.messages);
        lastRef.current = Math.max(lastRef.current, ...data.messages.map((m) => m.createdAt));
      }
      await api(`/api/chat/channels/${activeId}/read`, { method: "POST" }).catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  async function removeMessage(id: string) {
    try {
      await api(`/api/chat/messages/${id}`, { method: "DELETE" });
      const data = await api<{ messages: Message[] }>(`/api/chat/channels/${activeId}/messages`);
      setMessages(data.messages);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete message");
    }
  }

  async function createChannel(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("Channel name is required");
      return;
    }
    setCreating(true);
    try {
      const res = await api<{ id: string }>("/api/chat/channels", {
        method: "POST",
        json: { name: newName, description: newDesc || undefined },
      });
      toast.success("Channel created");
      setShowNew(false);
      setNewName("");
      setNewDesc("");
      await loadChannels(res.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create channel");
    } finally {
      setCreating(false);
    }
  }

  async function openDmPicker() {
    setShowDm(true);
    setDmUserId("");
    try {
      const data = await api<{ members: Member[] }>("/api/chat/members");
      setMembers(data.members);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load members");
    }
  }

  async function startDm(e: FormEvent) {
    e.preventDefault();
    if (!dmUserId) {
      toast.error("Choose a colleague");
      return;
    }
    setDmBusy(true);
    try {
      const res = await api<{ id: string }>("/api/chat/dm", {
        method: "POST",
        json: { userId: dmUserId },
      });
      setShowDm(false);
      await loadChannels(res.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start conversation");
    } finally {
      setDmBusy(false);
    }
  }

  if (Array.isArray(modules) && !can("chat")) {
    return (
      <>
        <PageHeader title="Team chat" />
        <Alert kind="error">You do not have access to team chat.</Alert>
      </>
    );
  }

  const renderChannelButton = (c: Channel) => (
    <button
      key={c.id}
      onClick={() => setActiveId(c.id)}
      className={
        c.id === activeId
          ? "flex w-full items-center justify-between rounded-lg bg-indigo-50 px-3 py-2 text-left text-sm font-semibold text-indigo-700"
          : "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
      }
    >
      <span className="truncate">{c.kind === "dm" ? c.name : `# ${c.name}`}</span>
      <span className="ml-1 flex items-center gap-1">
        {c.id !== activeId && c.unreadCount > 0 && (
          <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {c.unreadCount > 99 ? "99+" : c.unreadCount}
          </span>
        )}
        {c.kind !== "dm" && c.isDefault && <span className="text-[10px] uppercase text-slate-400">default</span>}
      </span>
    </button>
  );

  return (
    <>
      <PageHeader title="Team chat" subtitle="Chat with people in your organization. Type @ to mention someone." />

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
        <div className="card p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Channels</h2>
            <button className="text-xs font-semibold text-indigo-600 hover:underline" onClick={() => setShowNew(true)}>+ New</button>
          </div>
          <div className="space-y-1">
            {textChannels.map(renderChannelButton)}
            {textChannels.length === 0 && <p className="px-2 py-2 text-sm text-slate-400">No channels.</p>}
          </div>

          <div className="mb-2 mt-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Direct messages</h2>
            <button className="text-xs font-semibold text-indigo-600 hover:underline" onClick={openDmPicker}>+ New</button>
          </div>
          <div className="space-y-1">
            {dms.map(renderChannelButton)}
            {dms.length === 0 && <p className="px-2 py-2 text-sm text-slate-400">No direct messages.</p>}
          </div>
        </div>

        <div className="card flex h-[70vh] flex-col">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">
              {activeChannel ? (activeChannel.kind === "dm" ? activeChannel.name : `# ${activeChannel.name}`) : "Chat"}
            </h2>
            {activeChannel?.description && <p className="text-xs text-slate-500">{activeChannel.description}</p>}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {loading && <p className="text-sm text-slate-500">Loading messages…</p>}
            {!loading && messages.length === 0 && <p className="text-sm text-slate-500">No messages yet. Say hello.</p>}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${m.mine ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                  <div className={`mb-0.5 flex items-center gap-2 text-[11px] ${m.mine ? "text-indigo-100" : "text-slate-500"}`}>
                    <span className="font-semibold">{m.mine ? "You" : m.authorName}</span>
                    <span>{fmt(m.createdAt)}</span>
                  </div>
                  <p className={`whitespace-pre-wrap text-sm ${m.deleted ? "italic opacity-70" : ""}`}>
                    {m.deleted ? m.body : renderMentions(m.body, m.mine)}
                  </p>
                </div>
                {m.mine && !m.deleted && (
                  <button
                    className="ml-1 self-center text-xs text-slate-300 hover:text-red-500"
                    onClick={() => removeMessage(m.id)}
                    aria-label="Delete message"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-slate-100 px-3 py-3">
            <div className="relative flex-1">
              {mentionQuery !== null && mentionSuggestions.length > 0 && (
                <div className="absolute bottom-full left-0 mb-1 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                  {mentionSuggestions.map((m, i) => (
                    <button
                      key={m.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickMention(m);
                      }}
                      className={`block w-full px-3 py-2 text-left text-sm ${
                        i === mentionIndex ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {m.name}
                      <span className="ml-2 text-xs capitalize text-slate-400">{m.role}</span>
                    </button>
                  ))}
                </div>
              )}
              <textarea
                ref={textareaRef}
                className="input min-h-[2.5rem] w-full resize-none"
                rows={1}
                placeholder={activeId ? "Write a message…  (type @ to mention)" : "Select a channel"}
                value={body}
                disabled={!activeId}
                onChange={(e) => {
                  const value = e.target.value;
                  setBody(value);
                  const m = value.match(/(?:^|\s)@([A-Za-z0-9._-]*)$/);
                  setMentionQuery(m ? m[1] : null);
                  setMentionIndex(0);
                }}
                onKeyDown={(e) => {
                  if (mentionQuery !== null && mentionSuggestions.length > 0) {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setMentionIndex((i) => (i + 1) % mentionSuggestions.length);
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setMentionIndex((i) => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length);
                      return;
                    }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      pickMention(mentionSuggestions[mentionIndex] ?? mentionSuggestions[0]);
                      return;
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setMentionQuery(null);
                      return;
                    }
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
              />
            </div>
            <button type="submit" className="btn-primary px-4 py-2" disabled={sending || !activeId || !body.trim()}>
              {sending ? "…" : "Send"}
            </button>
          </form>
        </div>
      </div>

      {showNew && (
        <Modal title="New channel" onClose={() => setShowNew(false)}>
          <form onSubmit={createChannel} className="space-y-3">
            <div>
              <label className="label">Channel name</label>
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus placeholder="e.g. Sales" />
            </div>
            <div>
              <label className="label">Description (optional)</label>
              <input className="input" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={creating}>{creating ? "Creating…" : "Create channel"}</button>
            </div>
          </form>
        </Modal>
      )}

      {showDm && (
        <Modal title="New direct message" onClose={() => setShowDm(false)}>
          <form onSubmit={startDm} className="space-y-3">
            <div>
              <label className="label">Colleague</label>
              <select className="input" value={dmUserId} onChange={(e) => setDmUserId(e.target.value)} required autoFocus>
                <option value="">Select…</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setShowDm(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={dmBusy}>{dmBusy ? "Starting…" : "Start chat"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
