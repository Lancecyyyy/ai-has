/** Mark: a front-desk service bell on a carbon key. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="15" fill="currentColor" />
      <path d="M14 43a18 18 0 0 1 36 0z" fill="#ff4d00" />
      <rect x="30" y="19" width="4" height="7" rx="1.5" fill="#f7f7f5" />
      <circle cx="32" cy="17" r="4.2" fill="#f7f7f5" />
      <rect x="10" y="45" width="44" height="6" rx="3" fill="#f7f7f5" />
    </svg>
  );
}

export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark className={tone === "light" ? "text-white/10" : "text-carbon dark:text-[#2a2a28]"} />
      <span className={`font-display text-[20px] leading-none ${tone === "light" ? "text-paper" : "text-ink"}`}>AI-HAS</span>
    </span>
  );
}
