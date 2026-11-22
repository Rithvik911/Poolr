import { Activity, CarFront, Gauge, LogOut, Map, Plus, TicketCheck } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { apiConfig } from "../api";
import { useAuth } from "../features/auth/AuthProvider";
import { PoolrMark } from "./PoolrMark";
import { ThemeToggle } from "./ThemeToggle";

const links = [
  { to: "/app/search", label: "Find", icon: Map },
  { to: "/app/driver/new", label: "Offer", icon: Plus },
  { to: "/app/my-rides", label: "Rides", icon: CarFront },
  { to: "/app/bookings", label: "Bookings", icon: TicketCheck },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-canvas text-ink md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-ink/10 bg-paper p-5 md:flex md:flex-col">
        <PoolrMark />
        {apiConfig.useMocks && <span className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-warm/30 px-3 py-1.5 text-xs font-bold"><Activity className="size-3.5" />Demo mode</span>}
        <nav className="mt-10 grid gap-2" aria-label="Poolr app">
          {links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${isActive ? "bg-deep text-paper" : "text-muted hover:bg-ink/5 hover:text-ink"}`}><Icon className="size-5" />{label}</NavLink>)}
          <NavLink to="/under-the-hood" className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${isActive ? "bg-deep text-paper" : "text-muted hover:bg-ink/5 hover:text-ink"}`}><Gauge className="size-5" />Under the hood</NavLink>
        </nav>
        <div className="mt-auto border-t border-ink/10 pt-4">
          <div className="mb-3"><ThemeToggle /></div>
          <p className="truncate font-display text-base font-bold">{user?.name ?? "Poolr rider"}</p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
          <button type="button" onClick={signOut} className="mt-3 flex items-center gap-2 text-sm font-bold text-muted hover:text-error"><LogOut className="size-4" />Sign out</button>
        </div>
      </aside>
      <header className="flex items-center justify-between border-b border-ink/10 bg-paper px-4 py-3 md:hidden">
        <PoolrMark />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button type="button" onClick={signOut} className="grid size-10 place-items-center rounded-full border border-ink/15 text-muted" aria-label="Sign out"><LogOut className="size-4" /></button>
        </div>
      </header>
      <main className="min-w-0 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-0"><Outlet /></main>
      <nav className="fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-4 rounded-2xl border border-ink/10 bg-paper/95 p-1.5 shadow-xl backdrop-blur md:hidden" aria-label="Poolr mobile navigation">
        {links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[.7rem] font-bold ${isActive ? "bg-deep text-paper" : "text-muted"}`}><Icon className="size-5" />{label}</NavLink>)}
      </nav>
    </div>
  );
}
