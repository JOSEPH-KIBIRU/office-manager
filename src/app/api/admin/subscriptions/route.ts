import { NextRequest } from "next/server";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";
import { recordAudit } from "@/lib/audit";
import { PLANS, ANNUAL_DISCOUNT } from "@/lib/plans";

type PlanKey = "starter" | "professional" | "enterprise";
type Cycle = "monthly" | "annual";
type Status = "trial" | "active" | "canceled" | "past_due";

/**
 * Platform subscriptions (super admin only).
 * GET   /api/admin/subscriptions           - companies + plan metadata.
 * PATCH /api/admin/subscriptions           - set a company's plan/cycle/status.
 *   body: { orgId, plan, billingCycle, status? }
 * POST  /api/admin/subscriptions           - lifecycle actions.
 *   body: { orgId, action: "markPaid" | "cancel" | "startTrial", plan?, billingCycle? }
 */
export async function GET() {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    try {
      const companies = await cx().query(api.subscriptions.listCompanySubscriptions, {
        secret: secret(),
        superAdminId: session.id as never,
      });
      return ok({ companies, plans: PLANS, annualDiscount: ANNUAL_DISCOUNT });
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
      plan?: PlanKey;
      billingCycle?: Cycle;
      status?: Status;
    };
    if (!body.orgId) throw new HttpError(400, "orgId is required");
    if (!body.plan) throw new HttpError(400, "plan is required");
    if (!body.billingCycle) throw new HttpError(400, "billingCycle is required");

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
          summary: `Set ${body.plan} plan (${body.billingCycle})${body.status ? ` · ${body.status}` : ""} for company`,
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

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser(["super_admin"]);
    const body = (await req.json().catch(() => ({}))) as {
      orgId?: string;
      action?: "markPaid" | "cancel" | "startTrial";
      plan?: PlanKey;
      billingCycle?: Cycle;
    };
    if (!body.orgId) throw new HttpError(400, "orgId is required");
    if (!body.action) throw new HttpError(400, "action is required");

    try {
      let result: unknown;
      let summary: string;
      if (body.action === "markPaid") {
        result = await cx().mutation(api.subscriptions.markPaid, {
          secret: secret(),
          superAdminId: session.id as never,
          orgId: body.orgId as never,
        });
        summary = "Recorded subscription payment";
      } else if (body.action === "cancel") {
        result = await cx().mutation(api.subscriptions.cancelSubscription, {
          secret: secret(),
          superAdminId: session.id as never,
          orgId: body.orgId as never,
        });
        summary = "Cancelled subscription";
      } else {
        if (!body.plan || !body.billingCycle) {
          throw new HttpError(400, "plan and billingCycle are required to start a trial");
        }
        result = await cx().mutation(api.subscriptions.startTrial, {
          secret: secret(),
          orgId: body.orgId as never,
          plan: body.plan,
          billingCycle: body.billingCycle,
        });
        summary = `Started ${body.plan} trial`;
      }

      await recordAudit(
        session,
        { action: "subscriptions.lifecycle", module: "platform", summary },
        null,
        body.orgId
      );
      return ok(result);
    } catch (e) {
      return mapConvexError(e);
    }
  });
}
