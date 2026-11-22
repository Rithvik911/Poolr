import { useInfiniteQuery } from "@tanstack/react-query";
import { CarFront } from "lucide-react";
import { Link } from "react-router-dom";
import { api, apiConfig, friendlyError } from "../../api";
import { DemoBadge } from "../../components/DemoBadge";
import { SeatDots } from "../../components/SeatDots";
import { formatDistance, formatLocalTime } from "../../lib/format";

export function MyRidesPage() {
  const query = useInfiniteQuery({ queryKey: ["my-rides"], initialPageParam: undefined as string | undefined, queryFn: ({ pageParam }) => api.listOwnRides(pageParam), getNextPageParam: (page) => page.pagination.nextCursor ?? undefined });
  const rides = query.data?.pages.flatMap((page) => page.data) ?? [];
  return <div className="page-wrap"><header className="page-heading"><div><div className="flex items-center gap-3"><p className="kicker">Driver library</p>{apiConfig.useMocks && <DemoBadge />}</div><h1>Your published rides.</h1><p>Newest departures first, loaded with the API’s cursor.</p></div><Link to="/app/driver/new" className="press shrink-0 whitespace-nowrap rounded-full bg-deep px-5 py-3 text-sm font-bold text-paper">Offer a ride</Link></header>
    {query.isLoading && <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading your rides">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-64 animate-pulse rounded-3xl bg-ink/5" />)}</div>}
    {query.error && <div className="notice notice-error" role="alert">{friendlyError(query.error)}</div>}
    {!query.isLoading && !query.error && !rides.length && <div className="empty-card"><CarFront /><h2>No rides here yet</h2><p>Draw the route you already drive and publish the first one.</p><Link to="/app/driver/new" className="press mt-4 rounded-full bg-signature px-5 py-3 font-bold text-white">Draw a route</Link></div>}
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{rides.map((ride) => <Link key={ride.id} to={`/app/rides/${ride.id}`} state={{ ride }} className="ticket rounded-3xl border border-ink/10 bg-paper p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="flex justify-between gap-3"><span className="rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success">{ride.status}</span><strong className="font-display text-xl tabular-nums">{ride.priceDisplay}</strong></div><h2 className="mt-7 font-display text-2xl font-bold">{formatLocalTime(ride.departureTime)}</h2><div className="my-5 flex items-center gap-2"><span className="size-3 rounded-full bg-warm ring-2 ring-ink" /><span className="border-t border-dashed border-ink/30 flex-1" /><span className="size-3 rounded-full bg-signature ring-2 ring-ink" /></div><div className="flex justify-between text-sm text-muted"><span>{formatDistance(ride.routeLengthM)}</span><SeatDots total={ride.seatsTotal} available={ride.seatsAvailable} /></div><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full border border-ink/15 px-3 py-2 text-xs font-bold opacity-45">Start · later</span><span className="rounded-full border border-ink/15 px-3 py-2 text-xs font-bold opacity-45">Cancel · later</span></div></Link>)}</div>
    {query.hasNextPage && <button className="press mx-auto mt-7 block rounded-full border-2 border-ink px-6 py-3 font-bold" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>{query.isFetchingNextPage ? "Loading…" : "Load more"}</button>}
  </div>;
}
