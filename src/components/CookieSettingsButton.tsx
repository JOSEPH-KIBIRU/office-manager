"use client";

import type { ReactNode } from "react";

/** Opens the cookie consent banner from anywhere (footer, policy pages). */
export default function CookieSettingsButton({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("om-open-cookie-settings"))}
      className={className}
    >
      {children ?? "Cookie settings"}
    </button>
  );
}
