// Rochambeau mark: rock (circle), paper (square), scissors (triangle).
export function BrandMark({ size = 20, className, label = "Rochambeau Finance Terminal" }: { size?: number; className?: string; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} role="img" aria-label={label}>
      <circle cx="12" cy="6" r="4" fill="hsl(36, 100%, 50%)" />
      <rect x="2" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.7" />
      <path d="M18 14 L22.5 22 L13.5 22 Z" fill="hsl(36, 100%, 50%)" opacity="0.45" />
    </svg>
  );
}
