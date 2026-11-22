import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, tokenStore, type AuthResponse, type User } from "../../api";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  ready: boolean;
  acceptAuth(response: AuthResponse): void;
  signOut(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const token = useSyncExternalStore(tokenStore.subscribe, tokenStore.get, tokenStore.get);
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me", token], queryFn: () => api.me(), enabled: Boolean(token), retry: false, staleTime: 60_000 });

  function acceptAuth(response: AuthResponse) {
    tokenStore.set(response.accessToken);
    queryClient.setQueryData(["me", response.accessToken], { user: response.user });
  }

  function signOut() {
    tokenStore.set(null);
    queryClient.clear();
  }

  return (
    <AuthContext.Provider value={{ user: me.data?.user ?? null, token, ready: !token || !me.isLoading, acceptAuth, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
