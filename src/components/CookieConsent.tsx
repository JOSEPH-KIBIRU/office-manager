"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const COOKIE_NAME = "om_cookie_consent";
const CONSENT_VERSION = 1;

/** Pages where the banner may appear (public/marketing site). */
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/forgot-password",
  "/terms",
  "/privacy",
  "/cookie-policy",
  "/accept-terms",
];
const PUBLIC_PREFIXES = ["/solutions"];

export interface CookieConsent {
  necessary: true;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
  v: number;
  ts: number;
}

function readConsent(): CookieConsent | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)om_cookie_consent=([^;]+)/);
  if (!match) return null;
  try {
    const data = JSON.parse(decodeURIComponent(match[1])) as CookieConsent;
    if (data && data.v === CONSENT_VERSION) return data;
  } catch {
    /* ignore malformed */
  }
  return null;
}

function writeConsent(prefs: Pick<CookieConsent, "preferences" | "analytics" | "marketing">) {
  const payload: CookieConsent = {
    necessary: true,
    ...prefs,
    v: CONSENT_VERSION,
    ts: Date.now(),
  };
  const value = encodeURIComponent(JSON.stringify(payload));
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${value}; Max-Age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax${secure}`;
  // Let any listener (e.g. analytics) react to the choice.
  try {
    window.dispatchEvent(new CustomEvent("om-consent-change", { detail: payload }));
  } catch {
    /* ignore */
  }
}

const ROWS: Array<{ key: "preferences" | "analytics" | "marketing"; title: string; body: string }> = [
  { key: "preferences", title: "Preferences", body: "Remember choices like language, theme and layout." },
  { key: "analytics", title: "Analytics", body: "Helps us understand how the site is used so we can improve it." },
  { key: "marketing", title: "Marketing", body: "Used to show relevant offers and measure campaigns." },
];

export default function CookieConsent() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [forced, setForced] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState({ preferences: true, analytics: true, marketing: true });

  const isPublicPath =
    PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!isPublicPath) return;
    if (!readConsent()) setOpen(true);
  }, [isPublicPath]);

  // Allow any "Cookie settings" link anywhere on the site to reopen the banner.
  useEffect(() => {
    const reopen = () => {
      const existing = readConsent();
      setPrefs({
        preferences: existing?.preferences ?? true,
        analytics: existing?.analytics ?? true,
        marketing: existing?.marketing ?? true,
      });
      setShowPrefs(true);
      setForced(true);
      setOpen(true);
    };
    window.addEventListener("om-open-cookie-settings", reopen);
    return () => window.removeEventListener("om-open-cookie-settings", reopen);
  }, []);

  const save = useCallback(
    (choice: Pick<CookieConsent, "preferences" | "analytics" | "marketing">) => {
      writeConsent(choice);
      setOpen(false);
      setShowPrefs(false);
      setForced(false);
    },
    []
  );

  if (!open || (!isPublicPath && !forced)) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-4 bottom-4 z-[90] sm:left-4 sm:right-auto sm:w-[26rem]"
    >
      <div className="rounded-2xl border border-white/10 bg-zinc-900/95 p-4 text-zinc-200 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-indigo-600/20 text-lg">🍪</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">We value your privacy</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              We use cookies to run the site and, with your consent, to remember your preferences and understand how
              the site is used. See our{" "}
              <Link href="/cookie-policy" className="font-medium text-sky-300 underline-offset-2 hover:underline">
                Cookie Policy
              </Link>
              .
            </p>
          </div>
        </div>

        {showPrefs && (
          <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-medium text-zinc-200">Strictly necessary</p>
                <p className="text-zinc-500">Required for sign-in and security. Always on.</p>
              </div>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-400">
                Always
              </span>
            </div>
            {ROWS.map((row) => (
              <label key={row.key} className="flex cursor-pointer items-center justify-between gap-3 text-xs">
                <span>
                  <span className="block font-medium text-zinc-200">{row.title}</span>
                  <span className="block text-zinc-500">{row.body}</span>
                </span>
                <input
                  type="checkbox"
                  className="h-4 w-4 flex-none accent-indigo-500"
                  checked={prefs[row.key]}
                  onChange={(e) => setPrefs((p) => ({ ...p, [row.key]: e.target.checked }))}
                />
              </label>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {showPrefs ? (
            <>
              <button
                type="button"
                onClick={() => save(prefs)}
                className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
              >
                Save preferences
              </button>
              <button
                type="button"
                onClick={() => save({ preferences: false, analytics: false, marketing: false })}
                className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/5"
              >
                Reject all
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => save({ preferences: true, analytics: true, marketing: true })}
                className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={() => save({ preferences: false, analytics: false, marketing: false })}
                className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/5"
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={() => setShowPrefs(true)}
                className="w-full rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:text-white sm:w-auto"
              >
                Customise
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Opens the cookie banner again (used by the "Cookie settings" links). */
export function openCookieSettings() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("om-open-cookie-settings"));
  }
}
