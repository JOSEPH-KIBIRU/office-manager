"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Report the crash to Sentry (no-op when monitoring is disabled).
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en-KE">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", background: "#f1f5f9" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
          <div style={{ fontSize: "2rem" }}>⚠️</div>
          <h1 style={{ marginTop: "1rem", fontSize: "1.25rem", color: "#0f172a" }}>Something went wrong</h1>
          <p style={{ marginTop: "0.5rem", maxWidth: "28rem", fontSize: "0.875rem", color: "#475569" }}>
            The app hit an unexpected error. Please try again.
          </p>
          <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{ borderRadius: "0.5rem", background: "#4f46e5", color: "#fff", padding: "0.625rem 1.25rem", fontSize: "0.875rem", fontWeight: 500, border: "none", cursor: "pointer" }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{ borderRadius: "0.5rem", border: "1px solid #cbd5e1", background: "#fff", color: "#334155", padding: "0.625rem 1.25rem", fontSize: "0.875rem", fontWeight: 500, textDecoration: "none" }}
            >
              Go to homepage
            </a>
          </div>
          {error.digest && <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#94a3b8" }}>Reference: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
