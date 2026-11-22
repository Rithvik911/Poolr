import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TicketCheck } from "lucide-react";
import { api, apiConfig, friendlyError } from "../../api";
import { DemoBadge } from "../../components/DemoBadge";
import { formatInr, formatLocalTime } from "../../lib/format";

export function BookingsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["bookings"], queryFn: api.listBookings, enabled: apiConfig.useMocks });
  const cancel = useMutation({ mutationFn: api.cancelBooking, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }) });
  return <div className="page-wrap"><header className="page-heading"><div><div className="flex items-center gap-3"><p className="kicker">My bookings</p>{apiConfig.useMocks && <DemoBadge />}</div><h1>Seats you’ve claimed.</h1><p>Booking is shown only in demo mode until the API supports it.</p></div></header>
    {!apiConfig.useMocks ? <div className="empty-card"><TicketCheck /><h2>Bookings aren’t live yet</h2><p>No fake list here. Set <code>VITE_USE_MOCKS=true</code> to explore the labelled demo flow.</p></div> : !query.data?.length ? <div className="empty-card"><TicketCheck /><h2>No demo bookings yet</h2><p>Find a demo ride and run through the booking sheet.</p></div> : <div className="grid gap-4 lg:grid-cols-2">{query.data.map((booking) => <article key={booking.id} className="ticket rounded-3xl border border-ink/10 bg-paper p-5"><div className="flex flex-wrap items-center justify-between gap-3"><DemoBadge /><strong className="tabular-nums">{formatInr(booking.farePaise)}</strong></div><h2 className="mt-6 font-display text-2xl font-bold">{booking.seats} {booking.seats === 1 ? "seat" : "seats"}</h2><p className="mt-2 text-sm text-muted">Booked {formatLocalTime(booking.createdAt)}</p><div className="mt-5 flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">{booking.status}</span>{booking.status === "CONFIRMED" && <button className="rounded-full border border-error/30 px-4 py-2 text-sm font-bold text-error" onClick={() => cancel.mutate(booking.id)}>Cancel demo booking</button>}</div></article>)}</div>}
    {cancel.error && <div className="notice notice-error mt-5">{friendlyError(cancel.error)}</div>}
  </div>;
}
