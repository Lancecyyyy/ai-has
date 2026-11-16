export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="15" fill="currentColor" />
      <rect x="12" y="13" width="40" height="29" rx="7" fill="#150f6e" />
      <rect x="16" y="17" width="32" height="21" rx="4" fill="#f7dd7d" />
      <circle cx="26" cy="26.5" r="2.7" fill="#150f6e" />
      <circle cx="38" cy="26.5" r="2.7" fill="#150f6e" />
      <path d="M27 32q5 3 10 0" stroke="#150f6e" strokeWidth="2.3" fill="none" strokeLinecap="round" />
      <rect x="22" y="45" width="20" height="4" rx="2" fill="#fffdfb" />
      <rect x="15" y="51" width="34" height="4" rx="2" fill="#fffdfb" opacity=".55" />
    </svg>
  );
}

export function Logo({ className, tone = "brand" }: { className?: string; tone?: "brand" | "light" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark className={tone === "light" ? "text-white/15" : "text-cobalt"} />
      <span className={`font-display text-[22px] leading-none tracking-tight ${tone === "light" ? "text-cream" : "text-ink"}`}>AI-HAS</span>
    </span>
  );
}
