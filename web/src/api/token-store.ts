const STORAGE_KEY = "poolr.access-token";
let token: string | null = null;
const listeners = new Set<() => void>();

try {
  token = sessionStorage.getItem(STORAGE_KEY);
} catch {
  token = null;
}

export const tokenStore = {
  get: () => token,
  set(next: string | null) {
    token = next;
    try {
      if (next) sessionStorage.setItem(STORAGE_KEY, next);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Memory remains the source of truth when sessionStorage is unavailable.
    }
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
