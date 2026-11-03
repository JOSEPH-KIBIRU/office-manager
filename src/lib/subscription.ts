export interface SubscriptionLike {
  status: string;
  plan?: string | null;
  trialEndsAt?: number | null;
  currentPeriodEnd?: number | null;
}

export interface SubscriptionWarning {
  tone: "warning" | "danger";
  title: string;
  message: string;
}

function fmt(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Compute the in-app subscription banner. This is informational only — access is
 * not blocked (per product decision). Companies without a subscription record
 * are grandfathered (no banner).
 */
export function subscriptionWarning(
  sub: SubscriptionLike | null | undefined,
  now = Date.now()
): SubscriptionWarning | null {
  if (!sub) return null;

  if (sub.status === "past_due") {
    return {
      tone: "warning",
      title: "Subscription payment overdue",
      message: `Your subscription is past due${
        sub.currentPeriodEnd ? ` since ${fmt(sub.currentPeriodEnd)}` : ""
      }. Access remains available for now — please contact your provider to update payment and avoid interruption.`,
    };
  }

  if (sub.status === "canceled") {
    return {
      tone: "danger",
      title: "Subscription canceled",
      message:
        "Your subscription has been canceled. Access remains available for now — please contact your provider to reactivate it.",
    };
  }

  if (sub.status === "trial" && sub.trialEndsAt) {
    if (sub.trialEndsAt <= now) {
      return {
        tone: "danger",
        title: "Free trial ended",
        message:
          "Your free trial has ended. Access remains available for now — please contact your provider to choose a plan.",
      };
    }
    const days = Math.ceil((sub.trialEndsAt - now) / 86_400_000);
    if (days <= 7) {
      return {
        tone: "warning",
        title: "Trial ending soon",
        message: `Your free trial ends in ${days} day${days === 1 ? "" : "s"} (${fmt(
          sub.trialEndsAt
        )}). Contact your provider to choose a plan.`,
      };
    }
  }

  return null;
}

/**
 * Blocking rules: past_due, canceled and expired trials lose access. A trial
 * that is merely ending soon still works (warning only), and companies with no
 * subscription record are grandfathered.
 */
export function subscriptionBlocked(
  sub: SubscriptionLike | null | undefined,
  now = Date.now()
): boolean {
  if (!sub) return false;
  if (sub.status === "past_due" || sub.status === "canceled") return true;
  if (sub.status === "trial" && !!sub.trialEndsAt && sub.trialEndsAt <= now) return true;
  return false;
}
