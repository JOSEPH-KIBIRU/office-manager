import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret, requireMember, tsNow } from "./lib";
import { requireOptionalRef } from "./crmLib";
import { pushNotification } from "./notifications";

/** Direct (DM) channels are visible only to their two participants. */
function assertChannelAccess(channel: any, actorId: any) {
  if (channel.kind === "dm" && !(channel.dmUserIds ?? []).includes(actorId)) {
    throw new Error("Channel not found");
  }
}

/** Create the default "General" channel for an org if it has none yet. */
export const ensureDefaultChannel = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), actorId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const existing = await ctx.db
      .query("chatChannels")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();
    if (existing) return existing._id;
    const now = tsNow();
    return ctx.db.insert("chatChannels", {
      orgId: args.orgId,
      name: "General",
      description: "Company-wide chat",
      isDefault: true,
      kind: "channel",
      createdBy: args.actorId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listChannels = query({
  args: { secret: v.string(), orgId: v.id("organizations"), actorId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);

    const rows = await ctx.db
      .query("chatChannels")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const users = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const names = new Map(users.map((u) => [u._id as string, u.name] as const));

    const reads = await ctx.db
      .query("chatReads")
      .withIndex("by_user", (q) => q.eq("userId", args.actorId))
      .collect();
    const readMap = new Map(
      reads.filter((r) => r.orgId === args.orgId).map((r) => [r.channelId as string, r.lastReadAt] as const)
    );

    const visible = rows.filter(
      (c) => c.kind !== "dm" || (c.dmUserIds ?? []).includes(args.actorId)
    );
    // Count only recent unread messages per channel (capped at 100) instead of
    // loading the whole message history on every poll.
    const channels = await Promise.all(
      visible.map(async (c) => {
        const last = readMap.get(c._id as string) ?? 0;
        const recent = await ctx.db
          .query("chatMessages")
          .withIndex("by_org_channel_created", (q) =>
            q.eq("orgId", args.orgId).eq("channelId", c._id).gt("createdAt", last)
          )
          .order("desc")
          .take(100);
        const unreadCount = recent.filter(
          (m) => !m.deletedAt && m.authorId !== args.actorId
        ).length;

        let name = c.name;
        let dmUserId: string | null = null;
        if (c.kind === "dm") {
          const other = (c.dmUserIds ?? []).find((id) => id !== args.actorId);
          dmUserId = other ? String(other) : null;
          name = other ? names.get(other as string) ?? "Direct message" : "Direct message";
        }
        return {
          id: c._id,
          name,
          description: c.description ?? null,
          isDefault: c.isDefault,
          kind: c.kind ?? "channel",
          dmUserId,
          unreadCount,
          createdAt: c.createdAt,
        };
      })
    );

    return channels.sort((a, b) => {
      const ad = a.kind === "dm" ? 1 : 0;
      const bd = b.kind === "dm" ? 1 : 0;
      if (ad !== bd) return ad - bd;
      if (a.kind === "channel" && a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  },
});

export const createChannel = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const name = args.name.trim();
    if (!name) throw new Error("Channel name is required");
    if (name.length > 60) throw new Error("Channel name must be 60 characters or fewer");
    const existing = await ctx.db
      .query("chatChannels")
      .withIndex("by_org_name", (q) => q.eq("orgId", args.orgId).eq("name", name))
      .first();
    if (existing && existing.kind !== "dm") throw new Error("A channel with that name already exists");
    const now = tsNow();
    return ctx.db.insert("chatChannels", {
      orgId: args.orgId,
      name,
      description: args.description?.trim() || undefined,
      isDefault: false,
      kind: "channel",
      createdBy: args.actorId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Get or create the 1:1 direct channel between the actor and another member. */
export const ensureDirectChannel = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    otherUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    if (args.actorId === args.otherUserId) throw new Error("Choose another member");
    const other = await requireOptionalRef(ctx, args.orgId, args.otherUserId, "Member");
    if (!other.active) throw new Error("That member is not active");

    const pairKey = [args.actorId, args.otherUserId].map(String).sort().join(":");
    const channels = await ctx.db
      .query("chatChannels")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const existing = channels.find(
      (c) =>
        c.kind === "dm" &&
        (c.dmUserIds ?? []).map(String).sort().join(":") === pairKey
    );
    if (existing) return existing._id;

    const now = tsNow();
    return ctx.db.insert("chatChannels", {
      orgId: args.orgId,
      name: "Direct",
      isDefault: false,
      kind: "dm",
      dmUserIds: [args.actorId, args.otherUserId],
      createdBy: args.actorId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Active colleagues (for starting a DM). */
export const listMembers = query({
  args: { secret: v.string(), orgId: v.id("organizations"), actorId: v.id("users") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const users = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    return users
      .filter((u) => u.active && u._id !== args.actorId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((u) => ({ id: u._id, name: u.name, role: u.role }));
  },
});

export const markRead = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    channelId: v.id("chatChannels"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const channel = await ctx.db.get(args.channelId);
    if (!channel || channel.orgId !== args.orgId) throw new Error("Channel not found");
    assertChannelAccess(channel, args.actorId);
    const existing = await ctx.db
      .query("chatReads")
      .withIndex("by_user_channel", (q) =>
        q.eq("userId", args.actorId).eq("channelId", args.channelId)
      )
      .first();
    const now = tsNow();
    if (existing) {
      await ctx.db.patch(existing._id, { lastReadAt: now });
    } else {
      await ctx.db.insert("chatReads", {
        orgId: args.orgId,
        userId: args.actorId,
        channelId: args.channelId,
        lastReadAt: now,
      });
    }
    return true;
  },
});

export const listMessages = query({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    channelId: v.id("chatChannels"),
    limit: v.optional(v.number()),
    after: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.actorId);
    const channel = await ctx.db.get(args.channelId);
    if (!channel || channel.orgId !== args.orgId) throw new Error("Channel not found");
    assertChannelAccess(channel, args.actorId);

    const rows = await ctx.db
      .query("chatMessages")
      .withIndex("by_org_channel", (q) => q.eq("orgId", args.orgId).eq("channelId", args.channelId))
      .collect();
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 200);
    const recent =
      args.after !== undefined
        ? [...rows]
            .filter((m) => m.createdAt > args.after!)
            .sort((a, b) => a.createdAt - b.createdAt)
            .slice(0, 200)
        : [...rows].sort((a, b) => a.createdAt - b.createdAt).slice(-limit);

    const users = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const names = new Map(users.map((u) => [u._id as string, u.name] as const));

    return recent.map((m) => ({
      id: m._id,
      channelId: m.channelId,
      authorId: m.authorId,
      authorName: names.get(m.authorId as string) ?? "Unknown",
      body: m.deletedAt ? "This message was deleted" : m.body,
      mentionIds: (m.mentionIds ?? []) as string[],
      createdAt: m.createdAt,
      editedAt: m.editedAt ?? null,
      deleted: Boolean(m.deletedAt),
      mine: m.authorId === args.actorId,
    }));
  },
});

export const sendMessage = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    channelId: v.id("chatChannels"),
    body: v.string(),
    mentionIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const author = await requireMember(ctx, args.orgId, args.actorId);
    const channel = await ctx.db.get(args.channelId);
    if (!channel || channel.orgId !== args.orgId) throw new Error("Channel not found");
    assertChannelAccess(channel, args.actorId);
    const body = args.body.trim();
    if (!body) throw new Error("Message cannot be empty");
    if (body.length > 4000) throw new Error("Message must be 4000 characters or fewer");

    // Resolve mentions from the explicit list plus @tokens in the text.
    const users = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const dmParticipants = channel.kind === "dm" ? new Set((channel.dmUserIds ?? []).map(String)) : null;
    const mentionSet = new Set<string>();

    for (const id of args.mentionIds ?? []) {
      const u = users.find((x) => x._id === id);
      if (u && u.active && u._id !== args.actorId && (!dmParticipants || dmParticipants.has(String(u._id)))) {
        mentionSet.add(String(u._id));
      }
    }

    const tokens = [...body.matchAll(/@([A-Za-z0-9._-]+)/g)].map((m) => m[1].toLowerCase());
    if (tokens.length) {
      for (const u of users) {
        if (!u.active || u._id === args.actorId) continue;
        if (dmParticipants && !dmParticipants.has(String(u._id))) continue;
        const nameLower = u.name.toLowerCase();
        const emailLower = u.email.toLowerCase();
        const matched = tokens.some(
          (t) =>
            emailLower === t ||
            nameLower === t ||
            nameLower.startsWith(t + " ") ||
            nameLower.split(/\s+/).some((part) => part === t)
        );
        if (matched) mentionSet.add(String(u._id));
      }
    }

    const createdAt = tsNow();
    const id = await ctx.db.insert("chatMessages", {
      orgId: args.orgId,
      channelId: args.channelId,
      authorId: args.actorId,
      body,
      mentionIds: mentionSet.size ? ([...mentionSet] as never) : undefined,
      createdAt,
    });

    if (mentionSet.size) {
      const where = channel.kind === "dm" ? "a direct message" : `# ${channel.name}`;
      for (const uid of mentionSet) {
        await pushNotification(ctx, args.orgId, {
          userId: uid,
          type: "mention",
          title: `${author.name} mentioned you in ${where}`,
          body: body.slice(0, 140),
          link: "/chat",
        });
      }
    }

    return { id, createdAt, mentionIds: [...mentionSet] };
  },
});

export const deleteMessage = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    id: v.id("chatMessages"),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const user = await requireMember(ctx, args.orgId, args.actorId);
    const msg = await ctx.db.get(args.id);
    if (!msg || msg.orgId !== args.orgId) throw new Error("Message not found");

    const channel = await ctx.db.get(msg.channelId);
    if (!channel || channel.orgId !== args.orgId) throw new Error("Channel not found");
    assertChannelAccess(channel, args.actorId);

    if (msg.authorId !== args.actorId && user.role !== "admin") {
      throw new Error("You can only delete your own messages");
    }
    if (msg.deletedAt) return true;
    await ctx.db.patch(args.id, {
      body: "",
      deletedAt: tsNow(),
      deletedBy: args.actorId,
    });
    return true;
  },
});
