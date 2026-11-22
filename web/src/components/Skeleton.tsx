export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-ink/10 ${className}`} aria-hidden="true" />;
}
