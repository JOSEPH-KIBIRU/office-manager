"use client";

import { useState, FormEvent } from "react";
import { Alert, FieldError, inputCls } from "@/components/ui";
import Spinner from "@/components/Spinner";

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
}

export default function ContactForm({ initialSolution }: { initialSolution?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [subject, setSubject] = useState(
    initialSolution ? `Enquiry — ${initialSolution}` : ""
  );
  const [message, setMessage] = useState(
    initialSolution
      ? `Hi, I'm interested in ${initialSolution}. Please get in touch to discuss how it can work for our office.`
      : ""
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): boolean {
    const e: FormErrors = {};
    if (name.trim().length < 2) e.name = "Please enter your full name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Please enter a valid email address";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 13) e.phone = "Please enter a valid phone number";
    if (message.trim().length < 5) e.message = "Please enter a message (at least 5 characters)";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, company, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white">
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-7 w-7"><path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" /></svg>
        </div>
        <h3 className="mt-4 text-xl font-bold text-white">Message sent!</h3>
        <p className="mt-2 text-sm text-zinc-300">
          Thank you, {name.trim()}. Our team will get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Full name *</label>
          <input value={name} onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: undefined })); }} className={inputCls(errors.name)} placeholder="Jane Wanjiku" />
          <FieldError msg={errors.name} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email *</label>
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }} className={inputCls(errors.email)} placeholder="jane@company.co.ke" />
          <FieldError msg={errors.email} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Phone *</label>
          <input type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); if (errors.phone) setErrors((p) => ({ ...p, phone: undefined })); }} className={inputCls(errors.phone)} placeholder="07XX XXX XXX" />
          <FieldError msg={errors.phone} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Company (optional)</label>
          <input value={company} onChange={(e) => setCompany(e.target.value)} className="input" placeholder="Your company name" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Subject (optional)</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input" placeholder="e.g. Payroll pricing" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Message *</label>
        <textarea value={message} onChange={(e) => { setMessage(e.target.value); if (errors.message) setErrors((p) => ({ ...p, message: undefined })); }} rows={4} className={inputCls(errors.message)} placeholder="Tell us what you need…" />
        <FieldError msg={errors.message} />
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      <button type="submit" disabled={busy} className="btn-grad w-full py-3">
        {busy ? (<><Spinner className="h-4 w-4" /> Sending…</>) : "Send message"}
      </button>
    </form>
  );
}
