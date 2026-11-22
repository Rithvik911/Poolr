import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, CarFront, MapPin, Route, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { PoolrMark } from "../components/PoolrMark";
import { RouteLine } from "../components/RouteLine";
import { ThemeToggle } from "../components/ThemeToggle";

export function LandingPage() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <PoolrMark />
        <nav className="flex items-center gap-0 sm:gap-2"><ThemeToggle /><Link to="/auth?mode=login" className="rounded-full px-1 py-2 text-sm font-bold hover:bg-ink/5 sm:px-4">Log in</Link><Link to="/auth?mode=register" className="press rounded-full bg-deep px-3 py-3 text-sm font-bold text-paper sm:px-5"><span className="sm:hidden">Join</span><span className="hidden sm:inline">Join Poolr</span></Link></nav>
      </header>

      <main>
        <section className="mx-auto grid min-h-[calc(100svh-5rem)] max-w-7xl items-center gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[.85fr_1.15fr] lg:py-16">
          <motion.div initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-paper px-3 py-2 text-xs font-bold"><span className="size-2 rounded-full bg-success" />Pickup-first ride discovery</p>
            <h1 className="max-w-xl font-display text-[clamp(3.5rem,12vw,7.5rem)] font-semibold leading-[.82] tracking-[-.075em]">Your route has company.</h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-muted">Find a car already passing nearby, or put your spare seats to work. No made-up ratings. No mystery routes.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link to="/auth?mode=register" className="press rounded-full bg-signature px-6 py-3.5 font-bold text-white">Find my route</Link><Link to="/auth?mode=register&driver=1" className="press rounded-full border-2 border-ink px-6 py-3 font-bold">I’m driving</Link></div>
            <a href="#how" className="mt-10 inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-ink">See how it works <ArrowDown className="size-4" /></a>
          </motion.div>
          <div className="relative min-h-[25rem] overflow-hidden rounded-[2rem] border border-ink/10 bg-[#e8d9bd] shadow-[0_24px_70px_rgba(33,29,27,.15)] sm:min-h-[34rem]">
            <RouteLine className="absolute inset-0 h-full w-full" />
            <div className="absolute left-4 top-4 rounded-2xl bg-paper p-4 shadow-lg sm:left-7 sm:top-7"><p className="text-xs font-bold text-muted">Tuesday · 8:10 am</p><p className="mt-1 font-display text-xl font-bold">Majestic to Indiranagar</p></div>
            <div className="absolute bottom-5 right-4 max-w-[15rem] rounded-2xl bg-deep p-4 text-paper shadow-xl sm:bottom-8 sm:right-7"><p className="text-xs font-bold text-paper/60">Sample route</p><p className="mt-1 text-sm font-semibold">Hand-drawn, not snapped to roads</p></div>
          </div>
        </section>

        <section id="how" className="bg-deep px-5 py-20 text-paper sm:px-8">
          <div className="mx-auto max-w-7xl"><p className="text-sm font-bold text-warm">The useful overlap</p><h2 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-[-.04em] sm:text-6xl">Three small steps. One less empty car.</h2>
            <div className="mt-12 grid gap-px overflow-hidden rounded-3xl bg-paper/15 md:grid-cols-3">
              {[{ icon: MapPin, title: "Drop a pickup", body: "Place your point and choose how far you’re happy to walk." }, { icon: Route, title: "See the overlap", body: "Poolr ranks real routes by pickup distance and departure time." }, { icon: CarFront, title: "Choose what fits", body: "Compare seats, timing, route and price. Booking arrives in a later release." }].map(({ icon: Icon, title, body }) => <article key={title} className="bg-deep p-7"><Icon className="size-7 text-warm" /><h3 className="mt-8 font-display text-2xl font-bold">{title}</h3><p className="mt-3 leading-7 text-paper/65">{body}</p></article>)}
            </div>
          </div>
        </section>

        <section className="border-b border-ink/10 bg-paper px-5 py-8 sm:px-8"><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-4 text-sm font-bold text-muted"><span className="text-ink">Built with</span><span>React + TypeScript</span><span>MapLibre</span><span>TanStack Query</span><span>Express + MongoDB</span><span className="ml-auto inline-flex items-center gap-2 text-success"><ShieldCheck className="size-4" />Honest demo boundaries</span></div></section>
      </main>
      <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8"><PoolrMark /><p>Pickup-only matching today. More route intelligence later.</p></footer>
    </div>
  );
}
