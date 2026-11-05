import clsx from "clsx";

/** Two overlapping coins: the lender, the borrower, and the shared record between them. */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      <rect width="64" height="64" rx="18" fill="#2A1B4D" />
      <circle cx="25" cy="32" r="14" fill="#FFB020" />
      <circle cx="39" cy="32" r="14" fill="#FF6B5B" />
      <path d="M32 20.2a14 14 0 0 1 0 23.6 14 14 0 0 1 0-23.6Z" fill="#FFF6E5" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-display text-2xl font-bold leading-none">abeggi</span>
    </span>
  );
}
