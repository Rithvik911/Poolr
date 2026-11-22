import { apiUrl } from "./config";
import { normalizeApiError } from "./errors";
import { tokenStore } from "./token-store";

export async function request<T>(
  path: string,
  options: RequestInit & { versioned?: boolean } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  const accessToken = tokenStore.get();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (options.body) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(apiUrl(path, options.versioned ?? true), { ...options, headers });
  } catch (cause) {
    throw normalizeApiError({}, 0, cause instanceof Error ? cause.message : "Network request failed");
  }

  let body: unknown = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) body = await response.json();

  if (!response.ok) {
    if (response.status === 401) tokenStore.set(null);
    throw normalizeApiError(body, response.status, response.statusText || "Request failed");
  }
  return body as T;
}
