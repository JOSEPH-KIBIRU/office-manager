"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Idle-session timeout for the authenticated app.
 *
 * The session is invalidated after IDLE_TIMEOUT_MS of inactivity. The visible
 * countdown only appears in the final WARNING_SECONDS, together with a
 * "Stay signed in" button. Any pointer/touch/keyboard/scroll activity resets
 * the timer and hides the prompt.
 *
 * Reliability: the last-activity timestamp is persisted to localStorage and
 * compared against the wall clock, so the timeout still fires after the tab
 * was backgrounded (where setInterval is throttled), after the machine slept,
 * or after a full reload. On expiry it clears the session cookie
 * (DELETE /api/auth) and redirects to /login.
 */
const IDLE_TIMEOUT_MS = 4 * 60_000; // 4 minutes of inactivity before logout
const WARNING_SECONDS = 60; // show the countdown only in the last 60s of idle time
const TICK_MS = 1_000;
const STORAGE_KEY = "om_last_active";

export default function IdleSessionTimeout() {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const idleAtRef = useRef<number>(Date.now());
  const expiredRef = useRef(false);

  useEffect(() => {
    const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
      "mousemove",
    ];

    const expire = () => {
      if (expiredRef.current) return;
      expiredRef.current = true;
      setSecondsLeft(0);
    };

    const computeRemaining = () => {
      const remaining = Math.ceil((IDLE_TIMEOUT_MS - (Date.now() - idleAtRef.current)) / TICK_MS);
      if (remaining <= 0) expire();
      else if (remaining <= WARNING_SECONDS) setSecondsLeft(remaining);
    };

    const onActivity = () => {
      if (expiredRef.current) return;
      idleAtRef.current = Date.now();
      try {
        localStorage.setItem(STORAGE_KEY, String(idleAtRef.current));
      } catch {
        /* ignore */
      }
      setSecondsLeft(null);
    };

    // Resume from persisted activity time so a reload / sleeping machine is
    // still bound by the timeout.
    let stored: number | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) stored = Number(raw);
    } catch {
      /* ignore */
    }
    if (stored && Number.isFinite(stored)) {
      idleAtRef.current = stored;
      if (Date.now() - stored >= IDLE_TIMEOUT_MS) {
        expire();
      }
    } else {
      idleAtRef.current = Date.now();
    }

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }
    // Re-check immediately when the tab regains focus/visibility (throttled
    // timers may not have run while backgrounded).
    const onVisible = () => {
      if (document.visibilityState === "visible") computeRemaining();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", computeRemaining);

    const timer = window.setInterval(computeRemaining, TICK_MS);

    return () => {
      window.clearInterval(timer);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", computeRemaining);
    };
  }, []);

  useEffect(() => {
    if (secondsLeft !== 0) return;
    (async () => {
      setLoggingOut(true);
      try {
        await fetch("/api/auth", { method: "DELETE" });
      } catch {
        /* Ignore network errors; the redirect below still clears the app UI. */
      }
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      window.location.assign("/login?expired=1");
    })();
  }, [secondsLeft]);

  function stayActive() {
    if (expiredRef.current) return;
    idleAtRef.current = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, String(idleAtRef.current));
    } catch {
      /* ignore */
    }
    setSecondsLeft(null);
  }

  if (secondsLeft === null || secondsLeft <= 0) return null;

  const urgent = secondsLeft <= 15;
  const pct = Math.max(0, Math.min(1, secondsLeft / WARNING_SECONDS));
  const R = 18;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="fixed right-5 top-20 z-50 md:top-24" aria-live="polite">
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur ${
          urgent
            ? "border-red-300 bg-red-50/95 text-red-700"
            : "border-amber-300 bg-amber-50/95 text-amber-800"
        }`}
      >
        {/* Circular countdown */}
        <span className="relative grid h-11 w-11 flex-none place-items-center">
          <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90" aria-hidden="true">
            <circle cx="22" cy="22" r={R} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="4" />
            <circle
              cx="22"
              cy="22"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - pct)}
            />
          </svg>
          <span className="absolute text-xs font-bold tabular-nums">{secondsLeft}</span>
        </span>

        <div className="text-sm">
          {loggingOut ? (
            <p className="font-semibold">Signing you out…</p>
          ) : (
            <>
              <p className="font-semibold">Still there?</p>
              <p>
                Signing you out in{" "}
                <span className="font-bold tabular-nums">{secondsLeft}s</span>
              </p>
            </>
          )}
        </div>

        {!loggingOut && (
          <button
            type="button"
            onClick={stayActive}
            className="ml-1 flex-none rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
          >
            Stay signed in
          </button>
        )}
      </div>
    </div>
  );
}
