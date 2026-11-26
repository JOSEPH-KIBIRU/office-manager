import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { SOLUTIONS } from "@/lib/solutions";
import { GUIDES } from "@/lib/guides";
import { INDUSTRIES } from "@/lib/industries";

const TODAY = new Date().toISOString().split("T")[0];

/** Resolve the public origin of the current request so the sitemap always lists
 *  URLs on the same host it is served from (works for the custom domain and the
 *  *.vercel.app alias, which Search Console requires). */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const proto = (h.get("x-forwarded-proto") || "https").split(",")[0].trim();
  const host = h.get("x-forwarded-host") || h.get("host") || "officemanager.pigiecore.co.ke";
  return `${proto}://${host}`.replace(/\/$/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await requestOrigin();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: TODAY, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/solutions`, lastModified: TODAY, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/industries`, lastModified: TODAY, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/pricing`, lastModified: TODAY, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/security`, lastModified: TODAY, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/subprocessors`, lastModified: TODAY, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/status`, lastModified: TODAY, changeFrequency: "daily", priority: 0.3 },
    { url: `${base}/about`, lastModified: TODAY, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/templates`, lastModified: TODAY, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/resources`, lastModified: TODAY, changeFrequency: "weekly", priority: 0.7 },
    // llms.txt is the plain-text summary AI answer engines read; listing it here
    // helps crawlers discover it without guessing the well-known path.
    { url: `${base}/llms.txt`, lastModified: TODAY, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/cookie-policy`, lastModified: TODAY, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, lastModified: TODAY, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacy`, lastModified: TODAY, changeFrequency: "yearly", priority: 0.2 },
  ];

  const solutionPages: MetadataRoute.Sitemap = SOLUTIONS.map((s) => ({
    url: `${base}/solutions/${s.slug}`,
    lastModified: TODAY,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const industryPages: MetadataRoute.Sitemap = INDUSTRIES.map((industry) => ({
    url: `${base}/industries/${industry.slug}`,
    lastModified: TODAY,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const guidePages: MetadataRoute.Sitemap = GUIDES.map((guide) => ({
    url: `${base}/resources/${guide.slug}`,
    lastModified: guide.updated,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticPages, ...solutionPages, ...industryPages, ...guidePages];
}
