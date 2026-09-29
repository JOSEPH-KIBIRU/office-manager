import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/** Resolve the public origin of the current request (host-aware like sitemap). */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const proto = (h.get("x-forwarded-proto") || "https").split(",")[0].trim();
  const host = h.get("x-forwarded-host") || h.get("host") || "officemanager.pigiecore.co.ke";
  return `${proto}://${host}`.replace(/\/$/, "");
}

/** Signed-in application areas that must never be crawled or indexed. */
const PRIVATE_PATHS = [
  "/api/",
  "/accept-terms",
  "/change-password",
  "/forgot-password",
  "/admin",
  "/dashboard",
  "/accounting",
  "/analytics",
  "/attendance",
  "/assets",
  "/bill",
  "/bills",
  "/cars",
  "/checklists",
  "/departments",
  "/documents",
  "/invoices",
  "/leave",
  "/meetings",
  "/minutes",
  "/my-payslips",
  "/organization",
  "/org-chart",
  "/payroll",
  "/petty-cash",
  "/profile",
  "/reports",
  "/tasks",
  "/users",
  "/visitors",
  "/requisition/",
  "/invoice/",
  "/payslip/",
  "/p9",
];

/**
 * AI answer engines and dataset crawlers. They are allowed the public marketing
 * pages (which carry the product, FAQ and structured data) but never the
 * signed-in application. Listing them explicitly keeps the policy auditable and
 * signals deliberate intent rather than relying on the wildcard alone.
 */
const AI_CRAWLERS = [
  "GPTBot", // OpenAI
  "OAI-SearchBot", // OpenAI search
  "ChatGPT-User", // OpenAI user-triggered
  "ClaudeBot", // Anthropic
  "Claude-User", // Anthropic user-triggered
  "Claude-SearchBot", // Anthropic search
  "anthropic-ai",
  "PerplexityBot", // Perplexity
  "Perplexity-User",
  "Google-Extended", // Gemini / AI Overviews grounding
  "Applebot-Extended", // Apple Intelligence
  "meta-externalagent", // Meta AI
  "Bytespider", // ByteDance
  "CCBot", // Common Crawl (feeds many AI indexes)
  "Amazonbot", // Alexa / Rufus
  "DuckAssistBot",
];

/** Human-facing search engines. */
const SEARCH_CRAWLERS = ["Googlebot", "Bingbot", "DuckDuckBot", "Yahoo", "Yandex", "Baiduspider"];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await requestOrigin();

  return {
    rules: [
      // AI crawlers: public marketing pages only.
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: PRIVATE_PATHS,
      })),
      // Mainstream search engines: same split, explicit for clarity.
      ...SEARCH_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: PRIVATE_PATHS,
      })),
      // Everything else.
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
