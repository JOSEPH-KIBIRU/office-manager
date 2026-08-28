import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { assertSecret } from "./lib";

export const generateUploadUrl = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getFileUrl = mutation({
  args: { secret: v.string(), id: v.id("_storage") },
  handler: async (ctx, args) => {
    assertSecret(args.secret);
    return await ctx.storage.getUrl(args.id);
  },
});
