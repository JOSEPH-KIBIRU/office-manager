import { describe, it, expect } from "vitest";
import { api } from "../convex/_generated/api";
import { makeTestBackend } from "./helpers/convex";

process.env.CONVEX_SERVER_SECRET = "test-secret";
const SECRET = "test-secret";

type Backend = ReturnType<typeof makeTestBackend>;

async function setup() {
  const t = makeTestBackend();
  const now = Date.now();
  const mkOrg = (name: string, slug: string) =>
    t.run((ctx) => ctx.db.insert("organizations", { name, slug, active: true, createdAt: now }));
  const orgA = await mkOrg("A", "a");
  const orgB = await mkOrg("B", "b");
  const mkUser = (orgId: typeof orgA, email: string, role: string) =>
    t.run((ctx) =>
      ctx.db.insert("users", {
        orgId,
        name: email,
        email,
        passwordHash: "x",
        role,
        leaveBalance: 21,
        mustChangePassword: false,
        active: true,
        createdAt: now,
      })
    );
  const adminA = await mkUser(orgA, "admin@a.test", "admin");
  const empA = await mkUser(orgA, "emp@a.test", "employee");
  const otherA = await mkUser(orgA, "other@a.test", "employee");
  const adminB = await mkUser(orgB, "admin@b.test", "admin");
  return { t, orgA, orgB, adminA, empA, otherA, adminB };
}

describe("in-house chat", () => {
  it("creates a default General channel and sends/reads messages", async () => {
    const { t, orgA, adminA, empA } = await setup();
    const channelId = await t.mutation(api.chat.ensureDefaultChannel, {
      secret: SECRET,
      orgId: orgA,
      actorId: adminA,
    });

    const channels = await t.query(api.chat.listChannels, { secret: SECRET, orgId: orgA, actorId: adminA });
    expect(channels).toHaveLength(1);
    expect(channels[0].name).toBe("General");

    const sent = await t.mutation(api.chat.sendMessage, {
      secret: SECRET,
      orgId: orgA,
      actorId: adminA,
      channelId,
      body: "Hello team",
    });
    expect(sent.id).toBeTruthy();

    const forEmp = await t.query(api.chat.listMessages, {
      secret: SECRET,
      orgId: orgA,
      actorId: empA,
      channelId,
    });
    expect(forEmp).toHaveLength(1);
    expect(forEmp[0].body).toBe("Hello team");
    expect(forEmp[0].mine).toBe(false);

    const forAdmin = await t.query(api.chat.listMessages, {
      secret: SECRET,
      orgId: orgA,
      actorId: adminA,
      channelId,
    });
    expect(forAdmin[0].mine).toBe(true);
  });

  it("keeps channels and messages tenant-scoped", async () => {
    const { t, orgA, orgB, adminA, adminB } = await setup();
    const channelA = await t.mutation(api.chat.ensureDefaultChannel, {
      secret: SECRET,
      orgId: orgA,
      actorId: adminA,
    });

    // Org B has its own (empty) channel list.
    const bChannels = await t.query(api.chat.listChannels, { secret: SECRET, orgId: orgB, actorId: adminB });
    expect(bChannels).toHaveLength(0);

    // Org B cannot read or write org A's channel.
    await expect(
      t.query(api.chat.listMessages, { secret: SECRET, orgId: orgB, actorId: adminB, channelId: channelA })
    ).rejects.toThrow(/Channel not found/i);

    await expect(
      t.mutation(api.chat.sendMessage, {
        secret: SECRET,
        orgId: orgB,
        actorId: adminB,
        channelId: channelA,
        body: "cross tenant",
      })
    ).rejects.toThrow(/Channel not found/i);
  });

  it("lets authors and admins delete messages, not other members", async () => {
    const { t, orgA, adminA, empA } = await setup();
    const channelId = await t.mutation(api.chat.ensureDefaultChannel, {
      secret: SECRET,
      orgId: orgA,
      actorId: adminA,
    });
    const sent = await t.mutation(api.chat.sendMessage, {
      secret: SECRET,
      orgId: orgA,
      actorId: adminA,
      channelId,
      body: "delete me",
    });

    await expect(
      t.mutation(api.chat.deleteMessage, { secret: SECRET, orgId: orgA, actorId: empA, id: sent.id })
    ).rejects.toThrow(/only delete your own/i);

    await t.mutation(api.chat.deleteMessage, { secret: SECRET, orgId: orgA, actorId: adminA, id: sent.id });
    const rows = await t.query(api.chat.listMessages, { secret: SECRET, orgId: orgA, actorId: empA, channelId });
    expect(rows[0].deleted).toBe(true);
    expect(rows[0].body).toMatch(/deleted/i);
  });

  it("creates 1:1 DMs visible only to participants, with unread counts", async () => {
    const { t, orgA, adminA, empA, otherA } = await setup();
    const dmId = await t.mutation(api.chat.ensureDirectChannel, {
      secret: SECRET,
      orgId: orgA,
      actorId: adminA,
      otherUserId: empA,
    });
    const dmAgain = await t.mutation(api.chat.ensureDirectChannel, {
      secret: SECRET,
      orgId: orgA,
      actorId: empA,
      otherUserId: adminA,
    });
    expect(dmAgain).toBe(dmId);

    const adminChannels = await t.query(api.chat.listChannels, { secret: SECRET, orgId: orgA, actorId: adminA });
    const dmForAdmin = adminChannels.find((c) => c.id === dmId);
    expect(dmForAdmin?.kind).toBe("dm");
    expect(dmForAdmin?.name).toBe("emp@a.test");

    // A third member in the same org cannot see or read the DM.
    const otherChannels = await t.query(api.chat.listChannels, { secret: SECRET, orgId: orgA, actorId: otherA });
    expect(otherChannels.find((c) => c.id === dmId)).toBeUndefined();
    await expect(
      t.query(api.chat.listMessages, { secret: SECRET, orgId: orgA, actorId: otherA, channelId: dmId })
    ).rejects.toThrow(/Channel not found/i);

    // Recipient sees an unread badge until they mark it read.
    await t.mutation(api.chat.sendMessage, {
      secret: SECRET,
      orgId: orgA,
      actorId: adminA,
      channelId: dmId,
      body: "hi",
    });
    const empChannels = await t.query(api.chat.listChannels, { secret: SECRET, orgId: orgA, actorId: empA });
    expect(empChannels.find((c) => c.id === dmId)?.unreadCount).toBe(1);

    await t.mutation(api.chat.markRead, { secret: SECRET, orgId: orgA, actorId: empA, channelId: dmId });
    const after = await t.query(api.chat.listChannels, { secret: SECRET, orgId: orgA, actorId: empA });
    expect(after.find((c) => c.id === dmId)?.unreadCount).toBe(0);
  });

  it("creates mention notifications for the mentioned user", async () => {
    const { t, orgA, adminA, empA } = await setup();
    const channelId = await t.mutation(api.chat.ensureDefaultChannel, {
      secret: SECRET,
      orgId: orgA,
      actorId: adminA,
    });
    await t.mutation(api.chat.sendMessage, {
      secret: SECRET,
      orgId: orgA,
      actorId: adminA,
      channelId,
      body: "Please review this",
      mentionIds: [empA],
    });

    const msgs = await t.query(api.chat.listMessages, {
      secret: SECRET,
      orgId: orgA,
      actorId: adminA,
      channelId,
    });
    expect(msgs[0].mentionIds).toContain(empA);

    const notifications = await t.run((ctx) => ctx.db.query("notifications").collect());
    const forEmp = notifications.filter((n) => n.type === "mention" && n.userId === empA);
    expect(forEmp).toHaveLength(1);
    expect(forEmp[0].link).toBe("/chat");
    expect(notifications.some((n) => n.type === "mention" && n.userId === adminA)).toBe(false);
  });
});
