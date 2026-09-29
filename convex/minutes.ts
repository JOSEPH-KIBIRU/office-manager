import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { QueryCtx } from "./_generated/server";
import { assertSecret, tsNow, fmtCreated, requireMember } from "./lib";

type MinuteDoc = Doc<"minutes">;

async function assertMeetingInOrg(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  meetingId: Id<"meetings"> | undefined
) {
  if (!meetingId) return;
  const m = await ctx.db.get(meetingId);
  if (!m || m.orgId !== orgId) throw new Error("Meeting does not belong to your organization");
}

async function enrich(ctx: QueryCtx, m: MinuteDoc) {
  const author = await ctx.db.get(m.writtenBy);
  return {
    id: m._id,
    meeting_id: m.meetingId ?? null,
    title: m.title,
    meeting_date: m.meetingDate ?? null,
    attendees: m.attendeesText ?? null,
    points: m.points,
    content: m.content,
    file_name: m.fileName ?? null,
    file_path: m.fileId ?? null,
    ai_generated: m.aiGenerated ? 1 : 0,
    status: m.status,
    written_by: m.writtenBy,
    author_name: author?.name ?? "Unknown",
    created_at: fmtCreated(m.createdAt),
  };
}

export const listMinutes = query({
  args: { secret: v.string(), orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const docs = await ctx.db
      .query("minutes")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const key = (m: MinuteDoc) => m.meetingDate ?? new Date(m.createdAt).toISOString();
    const sorted = [...docs].sort((a, b) => key(b).localeCompare(key(a)));
    return Promise.all(sorted.map((d) => enrich(ctx, d)));
  },
});

export const getMinute = query({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("minutes") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.orgId !== args.orgId) return null;
    return enrich(ctx, doc);
  },
});

export const createMinute = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    writtenBy: v.id("users"),
    title: v.string(),
    meetingDate: v.optional(v.string()),
    attendeesText: v.optional(v.string()),
    points: v.string(),
    content: v.string(),
    meetingId: v.optional(v.id("meetings")),
    fileName: v.optional(v.string()),
    fileId: v.optional(v.id("_storage")),
    aiGenerated: v.boolean(),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    await requireMember(ctx, args.orgId, args.writtenBy);
    await assertMeetingInOrg(ctx, args.orgId, args.meetingId);
    return ctx.db.insert("minutes", {
      orgId: args.orgId,
      title: args.title,
      meetingDate: args.meetingDate,
      attendeesText: args.attendeesText,
      points: args.points,
      content: args.content,
      meetingId: args.meetingId,
      fileName: args.fileName,
      fileId: args.fileId,
      aiGenerated: args.aiGenerated,
      status: "draft",
      writtenBy: args.writtenBy,
      createdAt: tsNow(),
    });
  },
});

export const updateMinute = mutation({
  args: {
    secret: v.string(),
    orgId: v.id("organizations"),
    id: v.id("minutes"),
    title: v.optional(v.string()),
    meetingDateSet: v.boolean(),
    meetingDate: v.optional(v.union(v.string(), v.null())),
    attendeesSet: v.boolean(),
    attendeesText: v.optional(v.union(v.string(), v.null())),
    points: v.optional(v.string()),
    content: v.optional(v.string()),
    status: v.optional(v.union(v.literal("draft"), v.literal("final"))),
    meetingIdSet: v.boolean(),
    meetingId: v.optional(v.union(v.id("meetings"), v.null())),
    fileName: v.optional(v.string()),
    fileId: v.optional(v.id("_storage")),
    aiGenerated: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const row = await ctx.db.get(args.id);
    if (!row || row.orgId !== args.orgId) throw new Error("Minutes not found");
    if (args.status && !["draft", "final"].includes(args.status)) throw new Error("Invalid status");
    if (args.meetingIdSet && args.meetingId) {
      await assertMeetingInOrg(ctx, args.orgId, args.meetingId);
    }

    const patch: Record<string, unknown> = {};
    if (args.title !== undefined) patch.title = args.title;
    if (args.meetingDateSet) patch.meetingDate = args.meetingDate ?? undefined;
    if (args.attendeesSet) patch.attendeesText = args.attendeesText ?? undefined;
    if (args.points !== undefined) patch.points = args.points;
    if (args.content !== undefined) patch.content = args.content;
    if (args.status !== undefined) patch.status = args.status;
    if (args.meetingIdSet) patch.meetingId = args.meetingId ?? undefined;
    if (args.fileName !== undefined) patch.fileName = args.fileName;
    if (args.fileId !== undefined) patch.fileId = args.fileId;
    if (args.aiGenerated) patch.aiGenerated = true;

    await ctx.db.patch(row._id, patch);
    return true;
  },
});

export const deleteMinute = mutation({
  args: { secret: v.string(), orgId: v.id("organizations"), id: v.id("minutes") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    const row = await ctx.db.get(args.id);
    if (!row || row.orgId !== args.orgId) return true;
    if (row.fileId) await ctx.storage.delete(row.fileId);
    await ctx.db.delete(args.id);
    return true;
  },
});
