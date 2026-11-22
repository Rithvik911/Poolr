const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

export const apiConfig = {
  baseUrl: trimTrailingSlash(import.meta.env.VITE_API_BASE_URL ?? ""),
  prefix: `/${String(import.meta.env.VITE_API_PREFIX ?? "/v1").replace(/^\/+|\/+$/g, "")}`,
  useMocks: String(import.meta.env.VITE_USE_MOCKS ?? "false").toLowerCase() === "true",
  mapStyleUrl: String(import.meta.env.VITE_MAP_STYLE_URL ?? "").trim(),
  mapAttribution: String(import.meta.env.VITE_MAP_ATTRIBUTION ?? "").trim(),
} as const;

export function apiUrl(path: string, versioned = true): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiConfig.baseUrl}${versioned ? apiConfig.prefix : ""}${cleanPath}`;
}
