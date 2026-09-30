import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";

/**
 * Subscriptions management.
 * GET   /api/admin/subscriptions  - list companies with their subscription status.
 * PATCH /api/admin/subscriptions  - set the subscription plan for one company.
 *   body: { orgId: string, plan: "starter" | "professional" | "enterprise",
 *         billingCycle: "monthly" | "annual", status?: "trial" | "active" | "canceled" }
 */

export async function GET() {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    try {
      // Fetch all organizations except the platform placeholder
      const orgs = await cx().query(api.permissions.listCompaniesModules, {
        secret: secret(),
        superAdminId: session.id as never,
      });

      // For each org, fetch subscription details
      const companies = await Promise.all(
        orgs.map(async (org) => {
          const subs = await cx().query(
            api.subscriptions.getSubscription,
            { orgId: org.id }
          );

          return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            active: org.active,
            plan: subs?.plan ?? null,
            billingCycle: subs?.billingCycle ?? null,
            status: subs?.status ?? null,
            userCount: subs?.userCount ?? 0,
            trialEndsAt: subs?.trialEndsAt ?? null,
            currentPeriodEnd: subs?.currentPeriodEnd ?? null,
          };
        })
      );

      return ok({ companies });
    } catch (e) {
      return mapConvexError(e);
    }
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const body = (await req.json().catch(() => ({}))) as {
      orgId?: string;
      plan?: "starter" | "professional" | "enterprise";
      billingCycle?: "monthly" | "annual";
      status?:
        | "trial"
        | "active"
        | "canceled"
        | "past_due";
    };
    if (!body.orgId) throw new HttpError(400, "orgId is required");

    try {
      const result = await cx().mutation(api.subscriptions.setSubscriptionPlan, {
        secret: secret(),
        superAdminId: session.id as never,
        orgId: body.orgId as never,
        plan: body.plan,
        billingCycle: body.billingCycle,
        status: body.status,
      });

      await recordAudit(
        session,
        {
          action: "subscriptions.update",
          module: "platform",
          summary:
            body.plan !== undefined
              ? `Set plan to ${body.plan} (${body.billingCycle ?? "monthly"}) for company`
              : `Set status to ${body.status ?? "active"} for company`,
        },
        null,
        body.orgId
      );

      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}