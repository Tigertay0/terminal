// Rochambeau mark: rock (circle), paper (square), scissors (triangle), flat amber.
export function BrandMark({ size = 20, className, label = "Rochambeau Finance Terminal" }: { size?: number; className?: string; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}>
      <circle cx="12" cy="6" r="4" fill="hsl(var(--primary))" />
      <rect x="2" y="14" width="8" height="8" rx="1" fill="hsl(var(--primary))" opacity="0.7" />
      <path d="M18 14 L22.5 22 L13.5 22 Z" fill="hsl(var(--primary))" opacity="0.45" />
    </svg>
  );
}

/** The wordmark used in bars and headers: mark plus the product name in the interface face. */
export function Wordmark({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <BrandMark size={size} label="" />
      <span className="text-[13px] font-semibold text-foreground leading-none">Rochambeau</span>
    </span>
  );
}

/** Full-screen loading state shared by every mode. */
export function LoadingScreen({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="h-screen flex items-center justify-center bg-background" role="status">
      <div className="flex flex-col items-center gap-3 rise-in">
        <BrandMark size={32} />
        <div className="text-sm font-medium text-foreground">{title}</div>
        {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
      </div>
    </div>
  );
}
