import type { Variants, Transition } from "framer-motion";

/* ---------------------------------- */
/*  Easing Curves                     */
/* ---------------------------------- */
export const easings = {
  soft: [0.25, 0.1, 0.25, 1] as const,
  premium: [0.22, 1, 0.36, 1] as const,
  snappy: [0.16, 1, 0.3, 1] as const,
  easeOut: [0, 0, 0.2, 1] as const,
};

/* ---------------------------------- */
/*  Common Transitions                */
/* ---------------------------------- */
export const transitions = {
  soft: { duration: 0.5, ease: easings.soft } satisfies Transition,
  premium: { duration: 0.6, ease: easings.premium } satisfies Transition,
  snappy: { duration: 0.35, ease: easings.snappy } satisfies Transition,
  spring: { type: "spring", stiffness: 380, damping: 28 } satisfies Transition,
  springSoft: { type: "spring", stiffness: 260, damping: 24 } satisfies Transition,
};

/* ---------------------------------- */
/*  Core Variants                     */
/* ---------------------------------- */

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.premium,
  },
};

export const fadeInUpStrong: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: easings.premium },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: transitions.soft,
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.7, ease: easings.premium },
  },
};

/* ---------------------------------- */
/*  Stagger Containers                */
/* ---------------------------------- */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.03,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.premium,
  },
};

/* ---------------------------------- */
/*  Hover / Interaction Helpers        */
/* ---------------------------------- */
export const hoverLift = {
  y: -6,
  transition: transitions.snappy,
};

export const hoverLiftSoft = {
  y: -4,
  transition: transitions.snappy,
};

/** Soft animated lift for content cards. */
export const cardHoverSoft = {
  y: -6,
  transition: transitions.springSoft,
};

export const hoverScale = {
  scale: 1.02,
  transition: transitions.spring,
};

export const tapScale = {
  scale: 0.98,
};

/* ---------------------------------- */
/*  Viewport Defaults                 */
/* ---------------------------------- */
export const viewportOnce = {
  once: true,
  margin: "-80px",
} as const;

export const viewportOnceLoose = {
  once: true,
  margin: "-40px",
} as const;
