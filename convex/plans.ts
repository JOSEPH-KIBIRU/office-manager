/** Per-plan seat limits used by the backend (keep in sync with src/lib/plans.ts). */
export const PLAN_USER_LIMITS = {
  starter: 10,
  professional: 20,
  enterprise: null,
} as const;

export type PlanKey = keyof typeof PLAN_USER_LIMITS;
