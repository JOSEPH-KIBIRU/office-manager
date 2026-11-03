/** Animated padlock used on the subscription-blocked screen. */
export default function LockedPadlock() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="mx-auto h-16 w-16"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g className="padlock-shackle">
        <path d="M22 29v-7a10 10 0 0 1 20 0v7" stroke="#fbbf24" />
      </g>
      <rect x="16" y="29" width="32" height="24" rx="5" fill="#0f172a" stroke="#fbbf24" />
      <circle className="padlock-keyhole" cx="32" cy="39" r="3.2" fill="#fbbf24" stroke="none" />
      <path d="M32 42v5.5" stroke="#fbbf24" />
    </svg>
  );
}
