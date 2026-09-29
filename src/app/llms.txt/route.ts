import { MODULE_GROUPS, ALL_MODULE_NAMES } from "@/components/landing/ModuleGrid";
import { FAQS } from "@/lib/faqs";
import { SOLUTIONS } from "@/lib/solutions";
import { siteUrl } from "@/lib/siteUrl";

/**
 * /llms.txt — the convention used to give AI answer engines a compact, plain-text
 * summary of a site and its most important pages. It is served as text/plain
 * (rendered here as a route handler) and linked from robots.txt so crawlers can
 * find it without guessing.
 */
function buildLlmsTxt(): string {
  const base = siteUrl();

  const lines: string[] = [
    "# Office Manager",
    "",
    "> All-in-one office management software for Kenyan businesses. Handles KRA-compliant",
    "> statutory payroll, employee leave, attendance, documents, assets, visitors, petty",
    "> cash, vehicle logs, meetings with AI minutes, invoicing with KRA eTIMS e-invoicing,",
    "> double-entry accounting and task tracking — in one platform.",
    "",
    "Office Manager is a web application sold to small and medium enterprises (SMEs) in",
    "Kenya. It targets companies that currently run HR, payroll and finance on",
    "spreadsheets, paper files and WhatsApp, and replaces those with a single system where",
    "payroll deductions follow current KRA rules, employees self-serve leave, and finance",
    "gets a real ledger.",
    "",
    "## Key facts",
    "",
    "- Product type: SaaS business management web application",
    "- Market: Kenya (nationwide, with Nairobi, Mombasa, Kisumu, Nakuru and Eldoret as major centres)",
    "- Currency: Kenyan Shilling (KES)",
    "- Statutory coverage: PAYE, NSSF, SHIF, Affordable Housing Levy, HELB, KRA eTIMS e-invoicing",
    "- Compliance: Kenya Employment Act public holidays and overtime, KRA tax invoice rules",
    "- Works in: any modern desktop, tablet or mobile browser",
    "- Contact: support@pigiecore.co.ke · +254 798 118 515",
    "- Built by: PigieCore Solutions (https://pigiecore.co.ke)",
    "",
    "## Modules",
    "",
  ];

  for (const group of MODULE_GROUPS) {
    lines.push(`### ${group.title}`, "", group.summary, "");
    for (const m of group.modules) {
      lines.push(`- **${m.name}** — ${m.description}`);
    }
    lines.push("");
  }

  lines.push(
    "## All module names",
    "",
    ALL_MODULE_NAMES.join(", "),
    "",
    "## Frequently asked questions",
    "",
  );

  for (const f of FAQS) {
    lines.push(`### ${f.q}`, "", f.a, "");
  }

  lines.push(
    "## Pages",
    "",
    `- [Home](${base}/): product overview, all modules, pricing and FAQ`,
  );

  for (const s of SOLUTIONS) {
    lines.push(`- [${s.title}](${base}/solutions/${s.slug}): ${s.summary}`);
  }

  lines.push(
    `- [Terms and Conditions](${base}/terms)`,
    `- [Privacy Policy](${base}/privacy)`,
    `- [Cookie Policy](${base}/cookie-policy)`,
    "",
    "## Optional",
    "",
    `- [Sitemap](${base}/sitemap.xml)`,
    "",
  );

  return lines.join("\n");
}

export function GET(): Response {
  return new Response(buildLlmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
