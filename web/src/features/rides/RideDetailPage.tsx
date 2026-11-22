import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, CalendarClock, Footprints, MapPinned, TicketCheck, Users } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api, apiConfig, friendlyError, type Ride, type SearchItem } from "../../api";
import { DemoBadge } from "../../components/DemoBadge";
import { LazyMap } from "../../components/LazyMap";
import { SeatDots } from "../../components/SeatDots";
import { formatDistance, formatLocalTime } from "../../lib/format";

type DetailState = { ride?: Ride; item?: SearchItem };

export function RideDetailPage() {
  const { id = "" } = useParams();
  const state = useLocation().state as DetailState | null;
  const cachedRide = state?.ride;
  const query = useQuery({ queryKey: ["ride", id], queryFn: () => api.getRide(id), enabled: !cachedRide });
  const ride = cachedRide ?? query.data?.data;
  const item = state?.item;
  const [sheetOpen, setSheetOpen] = useState(false);

  if (query.isLoading && !ride) return <div className="page-wrap"><div className="h-96 animate-pulse rounded-3xl bg-ink/5" /></div>;
  if (!ride) return <div className="page-wrap"><Link to="/app/search" className="text-sm font-bold">Back to search</Link><div className="empty-card mt-8"><MapPinned /><h2>Ride not available</h2><p>{friendlyError(query.error)}</p></div></div>;

  return (
    <div className="page-wrap">
      <Link to="/app/search" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-ink"><ArrowLeft className="size-4" />Back to results</Link>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <section className="overflow-hidden rounded-3xl border border-ink/10 bg-paper shadow-sm"><LazyMap route={ride.route.coordinates} className="h-[24rem] sm:h-[34rem]" /><div className="border-t border-ink/10 p-5 text-sm text-muted">Route supplied by the driver · hand-drawn, not snapped to roads</div></section>
        <section className="rounded-3xl border border-ink/10 bg-paper p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2">{item?.source === "demo" && <DemoBadge />}<span className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">{ride.status}</span></div><strong className="font-display text-3xl tabular-nums">{ride.priceDisplay}</strong></div>
          <h1 className="mt-8 font-display text-4xl font-semibold tracking-[-.045em]">{formatLocalTime(ride.departureTime)}</h1>
          <p className="mt-2 text-muted">Shown in your local time zone</p>
          <div className="my-8 flex items-center gap-3"><span className="size-4 rounded-full border-[3px] border-ink bg-warm" /><span className="h-px flex-1 border-t-2 border-dashed border-ink/25" /><span className="size-4 rounded-full border-[3px] border-ink bg-signature" /></div>
          <dl className="grid grid-cols-2 gap-3">
            <Fact icon={MapPinned} label="Route" value={formatDistance(ride.routeLengthM)} />
            <Fact icon={Users} label="Seats" value={`${ride.seatsAvailable} available`} />
            <Fact icon={CalendarClock} label="Departure" value="Local time" />
            <Fact icon={Footprints} label="Pickup walk" value={item ? formatDistance(item.walkPickupM) : "Not searched"} />
          </dl>
          <div className="mt-8 flex items-center justify-between"><SeatDots total={ride.seatsTotal} available={ride.seatsAvailable} /><span className="text-sm font-semibold">{ride.seatsAvailable} of {ride.seatsTotal} seats free</span></div>
          {apiConfig.useMocks ? <button type="button" className="press mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-signature py-4 font-bold text-white" onClick={() => setSheetOpen(true)}><TicketCheck className="size-5" />Book this demo ride</button> : <div className="notice mt-8">Booking isn’t in the live API yet. You can inspect this ride, but there’s no pretend reserve button.</div>}
          <p className="mt-4 break-all text-xs text-muted">Ride ID · {ride.id}</p>
        </section>
      </div>
      {sheetOpen && <BookingSheet ride={ride} onClose={() => setSheetOpen(false)} />}
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof MapPinned; label: string; value: string }) { return <div className="rounded-2xl bg-canvas p-4"><Icon className="size-5 text-signature" /><dt className="mt-4 text-xs font-bold text-muted">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>; }

function BookingSheet({ ride, onClose }: { ride: Ride; onClose: () => void }) {
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const [seats, setSeats] = useState(1);
  const keyRef = useRef(crypto.randomUUID());
  const mutation = useMutation({
    mutationFn: () => api.bookRide({ rideId: ride.id, seats, pickup: { lng: ride.origin[0], lat: ride.origin[1] }, dropoff: { lng: ride.destination[0], lat: ride.destination[1] } }, keyRef.current),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  });
  return <div className="fixed inset-0 z-50 flex items-end bg-ink/45 backdrop-blur-sm md:items-center md:justify-center" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><motion.section role="dialog" aria-modal="true" aria-label="Book this demo ride" initial={reduceMotion ? false : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: .2 }} className="max-h-[calc(100dvh-1rem)] w-full overflow-y-auto overscroll-contain rounded-t-[2rem] bg-paper p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl md:max-w-md md:rounded-[2rem]">
    {mutation.isSuccess ? <div className="py-8 text-center"><motion.div initial={reduceMotion ? false : { scale: .7 }} animate={{ scale: 1 }} className="mx-auto grid size-16 place-items-center rounded-full bg-success text-white"><TicketCheck /></motion.div><h2 className="mt-5 font-display text-3xl font-bold">Seat sorted.</h2><p className="mt-2 text-muted">Demo booking confirmed for {seats} {seats === 1 ? "seat" : "seats"}.</p><button className="press mt-7 rounded-full bg-ink px-6 py-3 font-bold text-paper" onClick={onClose}>Done</button></div> : <><div className="flex items-start justify-between gap-4"><div className="min-w-0"><DemoBadge /><h2 className="mt-3 font-display text-3xl font-bold">Book your seat</h2></div><button onClick={onClose} className="shrink-0 rounded-full border border-ink/15 px-4 py-2 text-sm font-bold">Close</button></div><label className="form-field mt-7"><span>Seats</span><select value={seats} onChange={(event) => { setSeats(Number(event.target.value)); keyRef.current = crypto.randomUUID(); }}>{Array.from({ length: ride.seatsAvailable }, (_, index) => <option key={index + 1}>{index + 1}</option>)}</select></label><div className="mt-6 flex justify-between border-y border-ink/10 py-4"><span className="text-muted">Demo fare</span><strong className="tabular-nums">₹{((ride.pricePerSeatPaise * seats) / 100).toFixed(2)}</strong></div>{mutation.error && <div className="notice notice-error mt-5">{friendlyError(mutation.error)}</div>}<button className="press mt-6 w-full rounded-full bg-signature py-4 font-bold text-white" onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Holding your seats…" : mutation.error ? "Retry same attempt" : "Confirm demo booking"}</button><p className="mt-3 text-center text-xs leading-5 text-muted">A single idempotency key is kept for this attempt and reused on retry.</p></>}
  </motion.section></div>;
}
