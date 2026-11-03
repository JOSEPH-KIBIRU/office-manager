import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getValidatedSessionUser } from "@/lib/sessionValidation";
import { subscriptionBlocked } from "@/lib/subscription";
import LockedPadlock from "@/components/LockedPadlock";
import SubscriptionRequiredActions from "@/components/SubscriptionRequiredActions";

const PROVIDER = "Pigiecore Solutions";

function fmt(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

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

  const sub = user.subscription;
  const status = sub?.status ?? "past_due";
  const label = status === "canceled" ? "Canceled" : status === "trial" ? "Trial ended" : "Past due";
  const since =
    status === "past_due" && sub?.pastDueSince ? ` since ${fmt(sub.pastDueSince)}` : "";
  const detail =
    status === "canceled"
      ? "Your subscription has been canceled. Access is paused."
      : status === "trial"
      ? "Your free trial has ended. Access is paused."
      : `Your subscription payment is past due${since}. Access is paused until the balance is settled.`;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Slim dark banner */}
      <div className="bg-slate-950 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-400">
        {label} <span className="mx-2 text-slate-600">·</span> {PROVIDER}
      </div>

      <div className="mx-auto w-full max-w-lg px-4 py-14">
        <div className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-2xl ring-1 ring-white/10">
          <div className="border-b border-white/10 bg-white/[0.03] px-6 py-6 text-center">
            <LockedPadlock />
            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.35em] text-amber-400">
              {label}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">{PROVIDER}</h1>
          </div>

          <div className="px-6 py-6 text-center">
            <p className="text-sm leading-relaxed text-slate-300">{detail}</p>
            <p className="mt-3 text-sm text-slate-400">
              Please contact <span className="font-semibold text-white">{PROVIDER}</span> to settle
              payment and restore access.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <SubscriptionRequiredActions />
            </div>

            <p className="mt-6 text-[10px] uppercase tracking-[0.2em] text-slate-600">
              Status: {status.replace(/_/g, " ")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
