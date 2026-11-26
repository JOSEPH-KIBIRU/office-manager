"use client";

import { useEffect, useRef, useState } from "react";

interface TurnstileOptions {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Cloudflare Turnstile widget. Renders nothing when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is not configured, so local development and
 * preview deployments keep working until the keys are added.
 */
export default function TurnstileWidget({
  onToken,
  theme = "auto",
  resetKey = 0,
  className,
}: {
  onToken: (token: string | null) => void;
  theme?: "light" | "dark" | "auto";
  resetKey?: number;
  className?: string;
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    setFailed(false);

    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => {
          onToken(null);
          setFailed(true);
        },
      });
    };

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.addEventListener("load", render);
    const poll = window.setInterval(() => {
      if (window.turnstile) {
        window.clearInterval(poll);
        render();
      }
    }, 200);
    const giveUp = window.setTimeout(() => {
      window.clearInterval(poll);
      if (!window.turnstile) setFailed(true);
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearTimeout(giveUp);
      script?.removeEventListener("load", render);
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [siteKey, theme, resetKey, onToken]);

  if (!siteKey) return null;

  return (
    <div className={className}>
      <div ref={containerRef} />
      {failed && (
        <p className="mt-2 text-xs text-amber-700" role="alert">
          Verification could not load. Please refresh the page or call us on 0798 118 515.
        </p>
      )}
    </div>
  );
}
