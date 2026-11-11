import "server-only";
import OpenAI from "openai";

export interface LeadAiResult {
  score: number;
  confidence: number;
  summary: string;
  intent: string;
  nextAction: string;
  model: string;
}

export interface EmailLeadDecision {
  isLead: boolean;
  confidence: number;
  score: number;
  summary: string;
  intent: string;
  reason: string;
  model: string;
}

const DEFAULT_MODEL =
  process.env.CRM_AI_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const BASE_URL = process.env.CRM_AI_BASE_URL || "https://api.deepseek.com";
const API_KEY = process.env.CRM_AI_API_KEY || process.env.DEEPSEEK_API_KEY;

const FREE_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
]);

const NOISE = /no-?reply|do-?not-?reply|mailer-daemon|notifications?@|newsletter|unsubscribe|receipt|payment received|security alert|verify your|verification code|password reset|one[- ]time|otp\b|statement is ready|delivery status/i;
const LEAD_SIGNAL =
  /quote|quotation|pricing|price list|buy|purchase|order|demo|meeting|interested|enquiry|inquiry|looking for|need (a|an|some)|budget|proposal|tender|rfq|request (a|for)|call me|contact me|partnership|supplier|bulk|sample|trial|subscription|requirement|specification/i;

function client(): OpenAI | null {
  if (!API_KEY) return null;
  return new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });
}

export function crmAiEnabled(): boolean {
  return Boolean(API_KEY);
}

function clean(value: unknown, max = 500): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function clampScore(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, Math.min(100, n)));
}

function clampConfidence(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function parseJson(raw: string): Record<string, unknown> | null {
  let text = raw.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  text = text.slice(start, end + 1);
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function callJson(
  system: string,
  user: string
): Promise<Record<string, unknown> | null> {
  const api = client();
  if (!api) return null;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("AI request timed out")), 12_000)
  );
  try {
    const completion = await Promise.race([
      api.chat.completions.create({
        model: DEFAULT_MODEL,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      timeout,
    ]);
    const content = completion.choices[0]?.message?.content;
    return content ? parseJson(content) : null;
  } catch {
    return null;
  }
}

function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  const email = (match?.[2] ?? from).trim().toLowerCase();
  const name = (match?.[1] ?? "").trim();
  return { name: name || email.split("@")[0] || "Unknown", email };
}

function domainOf(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

function companyFromDomain(email: string): string | undefined {
  const domain = domainOf(email);
  if (!domain || FREE_DOMAINS.has(domain)) return undefined;
  const base = domain.split(".")[0].replace(/[-_]/g, " ");
  if (!base) return undefined;
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

function heuristicScore(input: {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  source?: string;
  value?: number;
  notes?: string;
  status?: string;
}): LeadAiResult {
  let score = 30;
  if (input.value && input.value > 0) score += 15;
  if (input.phone) score += 10;
  if (input.companyName) score += 10;
  if (input.email && !FREE_DOMAINS.has(domainOf(input.email))) score += 10;
  if ((input.source ?? "").toLowerCase().match(/email|referral|website|inbound/)) score += 10;
  if (input.notes && LEAD_SIGNAL.test(input.notes)) score += 15;
  if (input.status === "qualified") score += 15;
  if (input.status === "disqualified") score -= 25;
  score = clampScore(score);

  const intent = LEAD_SIGNAL.test(input.notes ?? "")
    ? clean((input.notes ?? "").match(LEAD_SIGNAL)?.[0] ?? "sales enquiry", 120)
    : "sales enquiry";

  return {
    score,
    confidence: 0.55,
    summary: clean(
      [
        input.companyName,
        input.contactName,
        input.email,
        input.phone ? `phone ${input.phone}` : null,
        input.source ? `via ${input.source}` : null,
        input.value ? `estimated ${input.value}` : null,
        input.notes,
      ]
        .filter(Boolean)
        .join(" · "),
      900
    ),
    intent,
    nextAction:
      score >= 70
        ? "Contact the lead today and confirm budget, decision-maker and timeline."
        : score >= 45
        ? "Qualify the lead: ask about requirements, budget and expected timeline."
        : "Review the lead details and decide whether to contact or disqualify.",
    model: "heuristic",
  };
}

export async function scoreLead(input: {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  source?: string;
  value?: number;
  notes?: string;
  status?: string;
}): Promise<LeadAiResult> {
  const fallback = heuristicScore(input);
  const json = await callJson(
    `You score B2B sales leads. Return ONLY valid JSON with keys:
{"score": number 0-100, "confidence": number 0-1, "summary": string, "intent": string, "nextAction": string}.
Be conservative; do not invent facts. Base the score on fit, buying intent, urgency, value and completeness.`,
    JSON.stringify(input)
  );
  if (!json) return fallback;
  return {
    score: clampScore(json.score),
    confidence: clampConfidence(json.confidence),
    summary: clean(json.summary, 1200) || fallback.summary,
    intent: clean(json.intent, 300) || fallback.intent,
    nextAction: clean(json.nextAction, 500) || fallback.nextAction,
    model: DEFAULT_MODEL,
  };
}

function heuristicEmailDecision(input: {
  from: string;
  subject?: string | null;
  snippet?: string | null;
}): EmailLeadDecision {
  const { name, email } = parseSender(input.from);
  const text = `${input.subject ?? ""} ${input.snippet ?? ""}`;
  const domain = domainOf(email);
  const company = companyFromDomain(email);
  const noisy = NOISE.test(`${email} ${text}`);
  const signal = LEAD_SIGNAL.test(text);
  const isLead = !noisy && (signal || (!FREE_DOMAINS.has(domain) && Boolean(company)));

  let score = 25;
  if (signal) score += 35;
  if (company) score += 10;
  if (!FREE_DOMAINS.has(domain) && domain) score += 10;
  if (noisy) score = 5;
  score = clampScore(score);

  return {
    isLead,
    confidence: noisy ? 0.65 : signal ? 0.7 : 0.45,
    score,
    summary: clean(
      [input.subject || "(no subject)", input.snippet, company, name].filter(Boolean).join(" · "),
      900
    ),
    intent: signal ? clean(text.match(LEAD_SIGNAL)?.[0] ?? "sales enquiry", 120) : "unknown",
    reason: noisy
      ? "Looks like a notification, newsletter or transactional email."
      : signal
      ? "The message contains buying or enquiry language."
      : company
      ? "Business sender; no clear buying signal."
      : "No clear buying signal.",
    model: "heuristic",
  };
}

export async function classifyInboundEmail(input: {
  from: string;
  subject?: string | null;
  snippet?: string | null;
}): Promise<EmailLeadDecision> {
  const fallback = heuristicEmailDecision(input);
  const json = await callJson(
    `You triage inbound B2B email for a CRM. Decide if it is a potential sales lead.
Return ONLY valid JSON with keys:
{"isLead": boolean, "confidence": number 0-1, "score": number 0-100, "summary": string, "intent": string, "reason": string}.
Do not mark newsletters, receipts, notifications, security alerts or personal messages as leads.
Do not invent facts beyond the supplied email metadata.`,
    JSON.stringify(input)
  );
  if (!json) return fallback;
  return {
    isLead: json.isLead === true,
    confidence: clampConfidence(json.confidence),
    score: clampScore(json.score),
    summary: clean(json.summary, 900) || fallback.summary,
    intent: clean(json.intent, 200) || fallback.intent,
    reason: clean(json.reason, 500) || fallback.reason,
    model: DEFAULT_MODEL,
  };
}
