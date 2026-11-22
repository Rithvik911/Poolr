import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CornerDownLeft, MapPin, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { api, friendlyError, type Coordinate } from "../../api";
import { LazyMap } from "../../components/LazyMap";
import { useAuth } from "../auth/AuthProvider";
import { formatDistance, rupeesToPaise, toDatetimeLocal } from "../../lib/format";
import { BENGALURU_ROUTES, routeLengthM, validateRoute } from "../../lib/geo";

const schema = z.object({
  departureTime: z.string().min(1, "Choose a departure time"),
  seatsTotal: z.number().int().min(1).max(8),
  priceRupees: z.string().refine((value) => rupeesToPaise(value) !== null, "Use rupees with up to two decimal places"),
});
type FormValues = z.output<typeof schema>;

export function CreateRidePage() {
  const [route, setRoute] = useState<Coordinate[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { departureTime: toDatetimeLocal(new Date(Date.now() + 86_400_000)), seatsTotal: 3, priceRupees: "120" } });
  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const routeError = validateRoute(route);
      if (routeError) throw new Error(routeError);
      const pricePerSeatPaise = rupeesToPaise(values.priceRupees);
      if (pricePerSeatPaise === null) throw new Error("Enter a valid price");
      return api.createRide({ route: { type: "LineString", coordinates: route }, departureTime: new Date(values.departureTime).toISOString(), seatsTotal: values.seatsTotal, pricePerSeatPaise });
    },
    onSuccess: (response) => navigate(`/app/rides/${response.data.id}`, { state: { ride: response.data } }),
  });
  const routeError = route.length ? validateRoute(route) : null;
  const length = routeLengthM(route);

  return (
    <div className="page-wrap">
      <header className="page-heading"><div><p className="kicker">Driver route studio</p><h1>Draw the route you actually drive.</h1><p>Click the map point by point. It’s hand-drawn—not snapped to roads.</p></div></header>
      {!user?.isDriver && <div className="notice notice-warn">Your account is rider-only. Create a driver-capable account to publish this route.</div>}
      <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <section className="overflow-hidden rounded-3xl border border-ink/10 bg-paper shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 p-4"><div><strong>{route.length} points</strong><span className="ml-3 text-sm text-muted">{formatDistance(length)}</span></div><div className="flex gap-2"><button className="icon-button" type="button" onClick={() => setRoute((points) => points.slice(0, -1))} disabled={!route.length} aria-label="Undo last point"><CornerDownLeft /></button><button className="icon-button" type="button" onClick={() => setRoute([])} disabled={!route.length} aria-label="Clear route"><Trash2 /></button></div></div>
          <LazyMap route={route} draw onRouteChange={setRoute} className="h-[22rem] sm:h-[34rem]" />
          <div className="border-t border-ink/10 p-4"><p className={`text-sm font-semibold ${routeError ? "text-error" : "text-success"}`}>{route.length ? routeError ?? "Route is ready to publish." : "Click the map to add your first point."}</p><div className="mt-3 flex flex-wrap gap-2">{Object.entries(BENGALURU_ROUTES).map(([name, points]) => <button key={name} type="button" className="rounded-full border border-ink/15 px-3 py-2 text-xs font-bold hover:bg-ink/5" onClick={() => setRoute(points)}>Use sample: {name}</button>)}</div></div>
        </section>

        <form className="h-fit rounded-3xl border border-ink/10 bg-paper p-5 shadow-sm sm:p-7" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <h2 className="font-display text-2xl font-bold">Ride details</h2>
          <div className="mt-6 grid gap-5">
            <label className="form-field"><span>Departure</span><input type="datetime-local" {...form.register("departureTime")} />{form.formState.errors.departureTime && <small role="alert">{form.formState.errors.departureTime.message}</small>}</label>
            <label className="form-field"><span>Seats</span><select {...form.register("seatsTotal", { valueAsNumber: true })}>{Array.from({ length: 8 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
            <label className="form-field"><span>Price per seat</span><span className="input-prefix"><b>₹</b><input inputMode="decimal" {...form.register("priceRupees")} /></span>{form.formState.errors.priceRupees && <small role="alert">{form.formState.errors.priceRupees.message}</small>}</label>
          </div>
          <div className="mt-6 grid gap-3 rounded-2xl bg-canvas p-4 text-sm"><span className="flex items-center justify-between"><span className="text-muted">Origin</span><strong className="tabular">{route[0] ? `${route[0][1].toFixed(4)}, ${route[0][0].toFixed(4)}` : "—"}</strong></span><span className="flex items-center justify-between"><span className="text-muted">Destination</span><strong className="tabular">{route.at(-1) ? `${route.at(-1)![1].toFixed(4)}, ${route.at(-1)![0].toFixed(4)}` : "—"}</strong></span></div>
          {mutation.error && <div className="notice notice-error mt-5" role="alert">{mutation.error instanceof Error && !('code' in mutation.error) ? mutation.error.message : friendlyError(mutation.error)}</div>}
          <button className="press mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-deep px-5 py-3.5 font-bold text-paper disabled:opacity-45" type="submit" disabled={mutation.isPending || Boolean(routeError) || !route.length || !user?.isDriver}><MapPin className="size-5" />{mutation.isPending ? "Publishing…" : "Publish ride"}</button>
          <p className="mt-3 text-center text-xs leading-5 text-muted">The API derives origin, destination, length, owner and availability.</p>
        </form>
      </div>
    </div>
  );
}
