/** Shared formatting so currency and dates are consistent across the app. */

const KES = new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "KES 1,234.00" */
export function formatKes(n: number | null | undefined): string {
  return `KES ${KES.format(Number(n ?? 0))}`;
}

/** Bare number with 2dp, no currency prefix. */
export function formatAmount(n: number | null | undefined): string {
  return KES.format(Number(n ?? 0));
}

/** "12 Sep 2026" from an ISO/DB date string (falls back to the raw value). */
export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

/** "12 Sep 2026, 14:05" */
export function formatDateTime(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  const d = typeof value === "number" ? new Date(value) : new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Relative "3h ago" / "2d ago" from a millisecond timestamp. */
export function timeAgo(ts: number): string {
  const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}
