import "server-only";

interface TurnstileResult {
  ok: boolean;
  error?: string;
}

/**
 * Verify a Cloudflare Turnstile token. When TURNSTILE_SECRET_KEY is not set the
 * check is skipped so the app keeps working before the keys are configured.
 * Once the secret is configured, a missing or invalid token is rejected.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true };

  const value = String(token ?? "").trim();
  if (!value || value.length > 4096) {
    return { ok: false, error: "Please complete the verification and try again." };
  }

  try {
    const form = new URLSearchParams({ secret, response: value });
    if (remoteIp && remoteIp !== "unknown") form.set("remoteip", remoteIp);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { ok: false, error: "Verification is temporarily unavailable. Please try again." };
    }

    const data = (await res.json()) as { success?: boolean };
    if (!data.success) {
      return { ok: false, error: "Verification failed. Please try again." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Verification is temporarily unavailable. Please try again." };
  }
}
