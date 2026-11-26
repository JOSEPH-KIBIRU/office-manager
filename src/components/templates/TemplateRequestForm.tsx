"use client";

import { useState, type FormEvent } from "react";
import { TEMPLATES } from "@/lib/templates";
import TurnstileWidget from "@/components/TurnstileWidget";

type Status = "idle" | "sending" | "sent" | "error";

export default function TemplateRequestForm() {
  const [phone, setPhone] = useState("");
  const [template, setTemplate] = useState(TEMPLATES[0]?.name ?? "Excel starter pack");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const captchaRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (captchaRequired && !captchaToken) {
      setStatus("error");
      setMessage("Please complete the verification below.");
      return;
    }

    setStatus("sending");

    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          subject: "Excel starter pack request",
          message: `Requested the Excel starter pack (${template}) from the website.`,
          turnstileToken: captchaToken ?? "",
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setCaptchaToken(null);
        setCaptchaReset((n) => n + 1);
        setStatus("error");
        setMessage(data.error || "Could not send your request. Please try again.");
        return;
      }

      setStatus("sent");
      setPhone("");
    } catch {
      setCaptchaToken(null);
      setCaptchaReset((n) => n + 1);
      setStatus("error");
      setMessage("Could not send your request. Please check your connection and try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6" role="status">
        <p className="font-semibold text-emerald-900">Request received</p>
        <p className="mt-2 text-sm leading-relaxed text-emerald-800">
          We&apos;ll call you back shortly. We&apos;ll go through what you need and then send the
          starter pack to you.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="template-phone" className="block text-sm font-medium text-slate-800">
          Phone number
        </label>
        <input
          id="template-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="0712 345 678"
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      <div>
        <label htmlFor="template-choice" className="block text-sm font-medium text-slate-800">
          Which template do you want help with?
        </label>
        <select
          id="template-choice"
          name="template"
          value={template}
          onChange={(event) => setTemplate(event.target.value)}
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          {TEMPLATES.map((item) => (
            <option key={item.slug} value={item.name}>
              {item.name}
            </option>
          ))}
          <option value="Several workbooks">Several workbooks</option>
        </select>
      </div>

      <TurnstileWidget
        onToken={setCaptchaToken}
        theme="light"
        resetKey={captchaReset}
        className="min-h-[65px]"
      />

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-xl bg-blue-600 px-5 py-3.5 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Request a callback"}
      </button>

      {status === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {message}
        </p>
      )}

      <p className="text-xs leading-relaxed text-slate-500">
        We only need your phone number. We&apos;ll use it to follow up and send the starter pack after
        a short walkthrough. The pack is free with no obligation to subscribe.
      </p>
    </form>
  );
}
