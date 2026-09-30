export type PlanKey = "starter" | "professional" | "enterprise";
export type BillingCycle = "monthly" | "annual";

export const ANNUAL_DISCOUNT = 0.05;

export interface PlanDef {
  key: PlanKey;
  name: string;
  /** Monthly price in KSh; null for "contact us". */
  monthly: number | null;
  /** Max users on the plan; null = unlimited / custom. */
  maxUsers: number | null;
  usersLabel: string;
  blurb: string;
  features: string[];
  cta: string;
  /** Anchor or link the CTA points to. */
  href: string;
  highlight?: boolean;
}

export const PLANS: PlanDef[] = [
  {
    key: "starter",
    name: "Starter",
    monthly: 3500,
    maxUsers: 10,
    usersLabel: "Up to 10 users (incl. admin)",
    blurb: "Everything a small office needs to get organised.",
    features: [
      "Payroll, leave & attendance",
      "Documents, assets & visitors",
      "Petty cash, car logs & meetings",
      "Invoicing & KRA eTIMS",
      "First month free",
    ],
    cta: "Start free trial",
    href: "#contact",
  },
  {
    key: "professional",
    name: "Professional",
    monthly: 8000,
    maxUsers: 20,
    usersLabel: "11 – 20 users",
    blurb: "For growing teams that need the full back office.",
    features: [
      "Everything in Starter",
      "Accounting & financial reports",
      "Analytics & org chart",
      "Task management & checklists",
      "Priority support",
    ],
    cta: "Request a demo",
    href: "#contact",
    highlight: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    monthly: null,
    maxUsers: null,
    usersLabel: "More than 20 staff",
    blurb: "Tailored rollout, onboarding and pricing for larger teams.",
    features: [
      "Everything in Professional",
      "Custom modules & integrations",
      "Dedicated onboarding",
      "Volume pricing",
      "SLA & account manager",
    ],
    cta: "Contact us",
    href: "#contact",
  },
];

/** Annual price in KSh (12 months minus the 5% discount). */
export function annualPrice(monthly: number): number {
  return Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT));
}

export function formatKes(n: number): string {
  return "KSh " + n.toLocaleString("en-KE");
}
