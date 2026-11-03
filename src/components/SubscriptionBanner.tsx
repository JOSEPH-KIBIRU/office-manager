import type { SubscriptionWarning } from "@/lib/subscription";

/** Full-width, informational subscription banner (never blocks access). */
export default function SubscriptionBanner({ warning }: { warning: SubscriptionWarning | null }) {
  if (!warning) return null;
  const tone =
    warning.tone === "danger"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div className={`border-b px-4 py-2.5 text-center text-sm print:hidden ${tone}`} role="status">
      <span className="font-semibold">{warning.title}.</span>{" "}
      <span>{warning.message}</span>
    </div>
  );
}
