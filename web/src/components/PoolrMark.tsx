import { Link } from "react-router-dom";

export function PoolrMark({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className={`inline-flex shrink-0 items-center gap-2 font-display text-xl font-bold tracking-[-0.05em] ${light ? "text-paper" : "text-ink"}`} aria-label="Poolr home">
      <svg viewBox="0 0 38 38" className="size-8 shrink-0" aria-hidden="true">
        <circle cx="19" cy="19" r="17" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M9 24c6-11 13-11 20-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="9" cy="24" r="3" fill="var(--color-signature)" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="29" cy="15" r="3" fill="var(--color-warm)" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span>poolr</span>
    </Link>
  );
}
