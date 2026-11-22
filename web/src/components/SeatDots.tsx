export function SeatDots({ total, available }: { total: number; available: number }) {
  return (
    <span className="inline-flex gap-1" aria-label={`${available} of ${total} seats available`}>
      {Array.from({ length: total }, (_, index) => <i key={index} className={`size-2.5 rounded-full border border-current ${index < available ? "bg-current" : "bg-transparent opacity-35"}`} />)}
    </span>
  );
}
