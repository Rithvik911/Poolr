import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider";

export function ProtectedRoute() {
  const { token, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <div className="grid min-h-screen place-items-center bg-canvas"><span className="font-display text-2xl font-bold">Tracing your route…</span></div>;
  const from = `${location.pathname}${location.search}${location.hash}`;
  return token ? <Outlet /> : <Navigate to="/auth?mode=login" replace state={{ from }} />;
}
