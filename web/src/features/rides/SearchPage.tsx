import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { LocateFixed, Search } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, apiConfig, friendlyError, type Coordinate, type SearchResponse } from "../../api";
import { DemoBadge } from "../../components/DemoBadge";
import { LazyMap } from "../../components/LazyMap";
import { RideTicket } from "../../components/RideTicket";
import { toDatetimeLocal } from "../../lib/format";

const schema = z.object({ pickupLng: z.number().min(-180).max(180), pickupLat: z.number().min(-60).max(60), dropoffLng: z.number().min(-180).max(180), dropoffLat: z.number().min(-60).max(60), departAfter: z.string(), seats: z.number().int().min(1).max(8), maxWalkM: z.number().int().min(200).max(3000) });
type Values = z.output<typeof schema>;

export function SearchPage() {
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { pickupLng: 77.5946, pickupLat: 12.9716, dropoffLng: 77.6412, dropoffLat: 12.9784, departAfter: toDatetimeLocal(new Date()), seats: 1, maxWalkM: 1000 } });
  const mutation = useMutation({ mutationFn: (values: Values) => api.searchRides({ pickup: [values.pickupLng, values.pickupLat], dropoff: apiConfig.useMocks ? [values.dropoffLng, values.dropoffLat] : undefined, departAfter: values.departAfter ? new Date(values.departAfter).toISOString() : undefined, seats: values.seats, maxWalkM: values.maxWalkM }), onSuccess: setResponse });
  const selectedRoute = response?.results[0]?.ride.route.coordinates ?? [];
  const pickup: Coordinate = [form.watch("pickupLng"), form.watch("pickupLat")];
  const dropoff: Coordinate = [form.watch("dropoffLng"), form.watch("dropoffLat")];

  return (
    <div className="page-wrap">
      <header className="page-heading"><div><div className="flex items-center gap-3"><p className="kicker">Find a ride</p>{apiConfig.useMocks && <DemoBadge />}</div><h1>Where can we pick you up?</h1><p>{apiConfig.useMocks ? "Full pickup and drop-off demo using final-spec mock contracts." : "The live API currently matches pickup proximity only."}</p></div></header>
      <form className="mb-5 grid min-w-0 gap-3 rounded-3xl border border-ink/10 bg-paper p-4 shadow-sm sm:grid-cols-2 2xl:grid-cols-[minmax(20rem,2fr)_minmax(20rem,2fr)_minmax(14rem,1.2fr)_minmax(8rem,.8fr)]" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <label className="form-field min-w-0"><span>Pickup [lng, lat]</span><span className="grid min-w-0 grid-cols-2 gap-2"><input aria-label="Pickup longitude" type="number" step="any" {...form.register("pickupLng", { valueAsNumber: true })} /><input aria-label="Pickup latitude" type="number" step="any" {...form.register("pickupLat", { valueAsNumber: true })} /></span></label>
        <label className="form-field min-w-0"><span>Drop-off [lng, lat] {apiConfig.useMocks ? "" : "· later"}</span><span className="grid min-w-0 grid-cols-2 gap-2"><input aria-label="Drop-off longitude" type="number" step="any" disabled={!apiConfig.useMocks} {...form.register("dropoffLng", { valueAsNumber: true })} /><input aria-label="Drop-off latitude" type="number" step="any" disabled={!apiConfig.useMocks} {...form.register("dropoffLat", { valueAsNumber: true })} /></span></label>
        <label className="form-field min-w-0"><span>Leave after</span><input type="datetime-local" {...form.register("departAfter")} /></label>
        <label className="form-field min-w-0"><span>Seats</span><select {...form.register("seats", { valueAsNumber: true })}>{Array.from({ length: 8 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select></label>
        <label className="form-field sm:col-span-2 2xl:col-span-3"><span>Happy to walk: <b className="text-ink">{form.watch("maxWalkM")} m</b></span><input className="range" type="range" min="200" max="3000" step="100" {...form.register("maxWalkM", { valueAsNumber: true })} /></label>
        <button className="press flex min-h-12 items-center justify-center gap-2 self-end rounded-full bg-signature px-5 font-bold text-white sm:col-span-2 2xl:col-span-1" type="submit" disabled={mutation.isPending}><Search className="size-5" />{mutation.isPending ? "Looking…" : "Find rides"}</button>
      </form>
      {mutation.error && <div className="notice notice-error mb-5" role="alert">{friendlyError(mutation.error)}</div>}
      <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <div className="relative min-h-[24rem] overflow-hidden rounded-3xl border border-ink/10 bg-paper shadow-sm xl:sticky xl:top-5 xl:h-[calc(100vh-3rem)]"><LazyMap route={selectedRoute} pickup={pickup} dropoff={apiConfig.useMocks ? dropoff : undefined} className="absolute inset-0" /><span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-paper/95 px-3 py-2 text-xs font-bold shadow"><LocateFixed className="size-4 text-signature" />{selectedRoute.length ? "Closest route preview" : "Search to plot routes"}</span></div>
        <section><div className="mb-4 flex items-end justify-between"><div><p className="kicker">Results</p><h2 className="font-display text-3xl font-bold">{response ? `${response.results.length} routes` : "Ready when you are"}</h2></div>{response?.truncated && <span className="rounded-full bg-warning/15 px-3 py-1 text-xs font-bold text-warning">Results capped</span>}</div>
          {!response && <EmptySearch />}
          {response && !response.results.length && <div className="empty-card"><Search /><h3>No route nearby yet</h3><p>Try a wider walking distance or a later departure.</p></div>}
          <div className="grid gap-4">{response?.results.map((item) => <RideTicket key={item.ride.id} item={item} />)}</div>
        </section>
      </div>
    </div>
  );
}

function EmptySearch() { return <div className="empty-card"><LocateFixed /><h3>Your route starts here</h3><p>Use the sample Bengaluru coordinates or enter your own.</p></div>; }
