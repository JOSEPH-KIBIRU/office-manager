"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Persistent PWA install control. Keeps a visible Install app button on every
 * page until the app is installed. Falls back to browser-specific instructions
 * when the browser does not expose beforeinstallprompt (notably iOS).
 */
const PUBLIC_PATHS = ["/", "/login", "/forgot-password", "/terms", "/privacy", "/cookie-policy", "/accept-terms", "/pricing", "/security", "/about"];

export default function PwaInstallPrompt() {
  const pathname = usePathname();
  const onMarketingSite =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/solutions") ||
    pathname.startsWith("/resources");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(true);
  const [help, setHelp] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setHelp(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    setHelp(true);
  }

  if (installed || onMarketingSite) return null;

  return (
    <>
      <button
        type="button"
        onClick={install}
        className="no-print fixed bottom-24 left-4 z-40 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg ring-1 ring-white/10 transition hover:bg-slate-800 sm:left-6"
        aria-label="Install app"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
        </svg>
        Install app
      </button>

      {help && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setHelp(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Install Office Manager"
            className="card w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Install Office Manager</h3>
              <button
                type="button"
                onClick={() => setHelp(false)}
                aria-label="Close install instructions"
                className="text-xl leading-none text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>
            {ios ? (
              <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
                <li>Open this site in <strong>Safari</strong>.</li>
                <li>Tap the <strong>Share</strong> button.</li>
                <li>Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</li>
              </ol>
            ) : (
              <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
                <li>Open your browser menu (⋮ or the install icon in the address bar).</li>
                <li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                <li>Confirm the installation.</li>
              </ol>
            )}
            <p className="mt-4 text-xs text-slate-400">
              Once installed, Office Manager opens like a normal app and appears on your home screen.
            </p>
            <div className="mt-5 flex justify-end">
              <button type="button" className="btn-primary" onClick={() => setHelp(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
