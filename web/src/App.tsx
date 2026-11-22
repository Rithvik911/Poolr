import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AuthProvider } from "./features/auth/AuthProvider";
import { AuthPage } from "./routes/AuthPage";
import { LandingPage } from "./routes/LandingPage";
import { ProtectedRoute } from "./routes/ProtectedRoute";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 20_000 }, mutations: { retry: false } } });
const SearchPage = lazy(() => import("./features/rides/SearchPage").then((module) => ({ default: module.SearchPage })));
const CreateRidePage = lazy(() => import("./features/rides/CreateRidePage").then((module) => ({ default: module.CreateRidePage })));
const RideDetailPage = lazy(() => import("./features/rides/RideDetailPage").then((module) => ({ default: module.RideDetailPage })));
const MyRidesPage = lazy(() => import("./features/rides/MyRidesPage").then((module) => ({ default: module.MyRidesPage })));
const BookingsPage = lazy(() => import("./features/rides/BookingsPage").then((module) => ({ default: module.BookingsPage })));
const UnderTheHoodPage = lazy(() => import("./features/bench/UnderTheHoodPage").then((module) => ({ default: module.UnderTheHoodPage })));
const loadable = (page: ReactNode) => <Suspense fallback={<div className="grid min-h-[50vh] place-items-center" role="status"><span className="font-display text-xl font-bold">Tracing your route…</span></div>}>{page}</Suspense>;
function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return <Outlet />;
}

const router = createBrowserRouter([{ element: <ScrollReset />, children: [
  { path: "/", element: <LandingPage /> },
  { path: "/auth", element: <AuthPage /> },
  { element: <ProtectedRoute />, children: [{ path: "/app", element: <AppShell />, children: [
    { index: true, element: <Navigate to="search" replace /> },
    { path: "search", element: loadable(<SearchPage />) },
    { path: "driver/new", element: loadable(<CreateRidePage />) },
    { path: "rides/:id", element: loadable(<RideDetailPage />) },
    { path: "my-rides", element: loadable(<MyRidesPage />) },
    { path: "bookings", element: loadable(<BookingsPage />) },
  ] }] },
  { path: "/under-the-hood", element: loadable(<UnderTheHoodPage />) },
  { path: "*", element: <Navigate to="/" replace /> },
] }]);

export default function App() {
  return <QueryClientProvider client={queryClient}><AuthProvider><RouterProvider router={router} /></AuthProvider></QueryClientProvider>;
}
