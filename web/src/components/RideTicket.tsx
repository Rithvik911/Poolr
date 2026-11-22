import { Clock3, Footprints, MapPinned } from "lucide-react";
import { Link } from "react-router-dom";
import type { SearchItem } from "../api";
import { formatDistance, formatLocalTime } from "../lib/format";
import { DemoBadge } from "./DemoBadge";
import { SeatDots } from "./SeatDots";

export function RideTicket({ item }: { item: SearchItem }) {
  const { ride } = item;
  return (
    <article className="ticket relative overflow-hidden rounded-[1.35rem] border border-ink/15 bg-paper shadow-[0_10px_35px_rgba(33,29,27,.08)]">
      <div className="flex items-start justify-between gap-4 p-5 pb-3">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">{item.source === "demo" && <DemoBadge />}<span className="text-xs font-bold uppercase tracking-wider text-muted">Scheduled</span></div>
          <h3 className="font-display text-2xl font-semibold tracking-tight">{formatLocalTime(ride.departureTime)}</h3>
        </div>
        <strong className="shrink-0 font-display text-2xl tabular-nums">{ride.priceDisplay}</strong>
      </div>
      <div className="mx-5 flex items-center gap-3 py-4">
        <span className="size-3 rounded-full border-[3px] border-ink bg-warm" />
        <svg viewBox="0 0 120 18" className="h-5 min-w-16 flex-1" aria-hidden="true"><path d="M2 9c27-12 46 12 72 0s27-4 44 0" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" /></svg>
        <span className="size-3 rounded-full border-[3px] border-ink bg-signature" />
      </div>
      <div className="grid grid-cols-2 gap-3 border-y border-dashed border-ink/20 px-5 py-4 text-sm text-muted">
        <span className="flex items-center gap-2"><Footprints className="size-4" />{formatDistance(item.walkPickupM)} walk</span>
        <span className="flex items-center justify-end gap-2"><MapPinned className="size-4" />{formatDistance(ride.routeLengthM)}</span>
        <span className="flex items-center gap-2"><Clock3 className="size-4" />Local time</span>
        <span className="flex items-center justify-end gap-2"><SeatDots total={ride.seatsTotal} available={ride.seatsAvailable} /></span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <span className="text-sm font-semibold">{ride.seatsAvailable} seats left</span>
        <Link to={`/app/rides/${ride.id}`} state={{ ride, item }} className="press rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-paper">View ride</Link>
      </div>
    </article>
  );
}
