export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      {!compact ? (
        <span className="text-[15px] font-semibold tracking-tight text-ink-900">
          Bug<span className="text-accent-700">Snap</span>
        </span>
      ) : null}
    </span>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="bs-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14b8a6" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#bs-logo-bg)" />
      <rect x="14" y="18" width="36" height="26" rx="5" fill="#ffffff" opacity="0.92" />
      <circle cx="32" cy="31" r="8" fill="none" stroke="#0f766e" strokeWidth="3.5" />
      <circle cx="32" cy="31" r="3" fill="#0f766e" />
      <rect x="24" y="12" width="16" height="7" rx="3" fill="#ffffff" opacity="0.92" />
      <rect x="44" y="24" width="7" height="4" rx="2" fill="#ffffff" opacity="0.92" />
    </svg>
  );
}
