"use client";

import { useState, type FormEvent } from "react";
import { TEMPLATES } from "@/lib/templates";

type Status = "idle" | "sending" | "sent" | "error";

export default function TemplateRequestForm() {
  const [phone, setPhone] = useState("");
  const [template, setTemplate] = useState(TEMPLATES[0]?.name ?? "Free template");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          subject: "Free template request",
          message: `Requested the ${template} template from the website.`,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Could not send your request. Please try again.");
        return;
      }

      setStatus("sent");
      setPhone("");
    } catch {
      setStatus("error");
      setMessage("Could not send your request. Please check your connection and try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6" role="status">
        <p className="font-semibold text-emerald-900">Request received</p>
        <p className="mt-2 text-sm leading-relaxed text-emerald-800">
          We&apos;ll call you back shortly. You can download the template immediately using the link
          above; no email is required.
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
          <option value="Several templates">Several templates</option>
        </select>
      </div>

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
        We only need your phone number. We&apos;ll use it to follow up about this request. Downloading
        the templates does not require a phone number.
      </p>
    </form>
  );
}
