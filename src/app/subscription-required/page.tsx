import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getValidatedSessionUser } from "@/lib/sessionValidation";
import { subscriptionBlocked, subscriptionWarning } from "@/lib/subscription";
import SubscriptionBanner from "@/components/SubscriptionBanner";
import SubscriptionRequiredActions from "@/components/SubscriptionRequiredActions";

/**
 * Blocking screen for companies whose subscription is past due, canceled, or
 * whose trial has expired. Shown instead of every company page.
 */
export default async function SubscriptionRequiredPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await getValidatedSessionUser(session);
  if (!user) redirect("/login");

  // If the issue was resolved (or the company was grandfathered), go back in.
  if (!subscriptionBlocked(user.subscription)) redirect("/dashboard");

  const warning = subscriptionWarning(user.subscription);

  return (
    <div className="min-h-screen bg-slate-50">
      <SubscriptionBanner warning={warning} />
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
        <div className="card w-full p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Subscription</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-800">Access paused</h1>
          <p className="mt-3 text-sm text-slate-600">
            Hello {user.name}, your company&apos;s subscription needs attention. Access to the
            dashboard has been paused. Please contact your provider to restore it.
          </p>
          {user.subscription?.status && (
            <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">
              Status: {user.subscription.status.replace(/_/g, " ")}
            </p>
          )}
          <div className="mt-6 flex justify-center gap-2">
            <SubscriptionRequiredActions />
          </div>
        </div>
      </div>
    </div>
  );
}
