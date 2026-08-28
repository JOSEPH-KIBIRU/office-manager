import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import { assertSecret, tsNow, fmtCreated } from "./lib";
import { pushNotification } from "./notifications";

type MeetingDoc = Doc<"meetings">;

async function enrich(ctx: QueryCtx, m: MeetingDoc) {
  const creator = await ctx.db.get(m.createdBy);
  const director = m.directorId ? await ctx.db.get(m.directorId) : null;
  return {
    id: m._id,
    title: m.title,
    agenda: m.agenda ?? null,
    location: m.location ?? null,
    scheduled_at: m.scheduledAt,
    attendees: JSON.stringify(m.attendeeIds),
    director_id: m.directorId ?? null,
    director_name: director?.name ?? null,
    status: m.status,
    created_by_name: creator?.name ?? "Unknown",
    created_at: fmtCreated(m.createdAt),
  };
}

export const listMeetings = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const docs = await ctx.db
      .query("meetings")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const sorted = [...docs].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
    return Promise.all(sorted.map((d) => enrich(ctx, d)));
  },
});

export const getMeeting = query({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("meetings") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) return null;
    return enrich(ctx, doc);
  },
});

export const createMeeting = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    createdBy: v.id("users"),
    title: v.string(),
    agenda: v.optional(v.string()),
    location: v.optional(v.string()),
    scheduledAt: v.string(),
    attendeeIds: v.array(v.id("users")),
    directorId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const creator = await ctx.db.get(args.createdBy);
    const id = await ctx.db.insert("meetings", {
      orgId: args.orgId,
      title: args.title,
      agenda: args.agenda,
      location: args.location,
      scheduledAt: args.scheduledAt,
      attendeeIds: args.attendeeIds,
      directorId: args.directorId,
      status: "scheduled",
      createdBy: args.createdBy,
      createdAt: tsNow(),
    });
    for (const att of args.attendeeIds) {
      if (att === args.createdBy) continue;
      await pushNotification(ctx, args.orgId as unknown as string, {
        userId: att as unknown as string,
        type: "meeting",
        title: "Meeting invitation",
        body: `${creator?.name ?? "Someone"} invited you to "${args.title}" on ${args.scheduledAt}.`,
        link: "/meetings",
      });
    }
    return id;
  },
});

export const updateMeeting = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("meetings"),
    title: v.optional(v.string()),
    agenda: v.optional(v.string()),
    location: v.optional(v.string()),
    scheduledAt: v.optional(v.string()),
    attendeeIds: v.optional(v.array(v.id("users"))),
    directorIdSet: v.boolean(),
    directorId: v.optional(v.union(v.id("users"), v.null())),
    status: v.optional(
      v.union(v.literal("scheduled"), v.literal("completed"), v.literal("cancelled"))
    ),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const row = await ctx.db.get(args.id);
    if (!row || row.orgId !== args.orgId) throw new Error("Meeting not found");
    if (args.status && !["scheduled", "completed", "cancelled"].includes(args.status)) {
      throw new Error("Invalid status");
    }

    const patch: Record<string, unknown> = {};
    if (args.title !== undefined) patch.title = args.title;
    if (args.agenda !== undefined) patch.agenda = args.agenda;
    if (args.location !== undefined) patch.location = args.location;
    if (args.scheduledAt !== undefined) patch.scheduledAt = args.scheduledAt;
    if (args.attendeeIds !== undefined) patch.attendeeIds = args.attendeeIds;
    if (args.directorIdSet) patch.directorId = args.directorId ?? undefined;
    if (args.status !== undefined) patch.status = args.status;

    await ctx.db.patch(row._id, patch);

    const finalAttendees = (patch.attendeeIds as Array<string> | undefined) ?? (row.attendeeIds as Array<string>);
    if (args.status === "completed" || args.status === "cancelled") {
      const label = args.status === "completed" ? "completed" : "cancelled";
      for (const att of finalAttendees) {
        await pushNotification(ctx, args.orgId as unknown as string, {
          userId: att as unknown as string,
          type: "meeting",
          title: `Meeting ${label}`,
          body: `"${(patch.title as string | undefined) ?? row.title}" was marked ${label}.`,
          link: "/meetings",
        });
      }
    }

    return {
      prevAttendees: row.attendeeIds as Array<string>,
      finalTitle: (patch.title as string | undefined) ?? row.title,
      finalScheduledAt: (patch.scheduledAt as string | undefined) ?? row.scheduledAt,
      finalLocation: (patch.location as string | undefined) ?? row.location ?? null,
      rescheduled: Boolean(args.scheduledAt && args.scheduledAt !== row.scheduledAt),
    };
  },
});

export const deleteMeeting = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("meetings") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const row = await ctx.db.get(args.id);
    if (!row || row.orgId !== args.orgId) throw new Error("Meeting not found");
    await ctx.db.delete(args.id);
    return true;
  },
});
