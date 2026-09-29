import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { assertSecret, tsNow } from "./lib";

/**
 * Runs yearly (cron): resets every active user's leave balance to 21 days,
 * per organization. Records one annualReset row per org per year so reruns
 * are no-ops.
 */
export const annualLeaveReset = internalMutation({
  handler: async (ctx) => {
    const secret = process.env.CONVEX_SERVER_SECRET;
    assertSecret(secret);

    const year = new Date().getFullYear();
    const orgs = await ctx.db.query("organizations").collect();

    let resetUsers = 0;
    for (const org of orgs) {
      if (!org.active) continue;

      const already = await ctx.db
        .query("annualReset")
        .filter((q) =>
          q.and(q.eq(q.field("orgId"), org._id), q.eq(q.field("year"), year))
        )
        .first();
      if (already) continue;

      const users = await ctx.db
        .query("users")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .collect();

      const entitlement = org.leaveEntitlement ?? 21;
      const carryMax = org.leaveCarryOverMax ?? 0;

      for (const u of users) {
        if (!u.active) continue;
        const remaining = Math.max(0, u.leaveBalance);
        const carried = Math.min(remaining, carryMax);
        const encashed = org.leaveEncashment ? Math.max(0, remaining - carryMax) : 0;
        const newBalance = entitlement + carried;
        if (u.leaveBalance !== newBalance) {
          await ctx.db.patch(u._id, { leaveBalance: newBalance });
        }
        await ctx.db.insert("leaveCarryOvers", {
          orgId: org._id,
          userId: u._id,
          year,
          carriedDays: carried,
          encashedDays: encashed,
          createdAt: tsNow(),
        });
      }
      resetUsers += users.length;

      await ctx.db.insert("annualReset", {
        orgId: org._id,
        year,
        runAt: tsNow(),
      });
    }
    return { organizations: orgs.length, usersTouched: resetUsers };
  },
});

const crons = cronJobs();

// Jan 1st, 00:00 UTC — yearly leave balance reset for every organization.
crons.cron("annual-leave-reset", "0 0 1 1 *", internal.crons.annualLeaveReset, {});

export default crons;
