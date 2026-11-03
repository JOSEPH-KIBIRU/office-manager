import type { SubscriptionWarning } from "@/lib/subscription";

/** Full-width, informational subscription banner (dark theme). */
export default function SubscriptionBanner({ warning }: { warning: SubscriptionWarning | null }) {
  if (!warning) return null;
  return (
    <div className="border-b border-slate-800 bg-slate-950 px-4 py-2.5 text-center text-sm text-white print:hidden" role="status">
      <span className="mr-2 rounded bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
        Subscription
      </span>
      <span className="font-semibold">{warning.title}.</span>{" "}
      <span className="text-slate-300">{warning.message}</span>
    </div>
  );
}
