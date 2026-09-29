/**
 * Canonical public URL for links we generate (SMS/email, canonical tags, JSON-LD).
 * Prefers NEXT_PUBLIC_SITE_URL, then APP_URL — but never the *.vercel.app alias,
 * so customer-facing links always use the PigieCore subdomain.
 */
export function siteUrl(): string {
  const clean = (v?: string) => (v || "").replace(/\/$/, "");
  const isVercel = (v: string) => /\.vercel\.app$/i.test(v);

  const site = clean(process.env.NEXT_PUBLIC_SITE_URL);
  if (site && !isVercel(site)) return site;

  const app = clean(process.env.APP_URL);
  if (app && !isVercel(app)) return app;

  return "https://officemanager.pigiecore.co.ke";
}
