import type { AuthResponse, Booking, BookingInput, CreateRideInput, OwnRidesPage, PoolrApi, Ride, SearchInput, SearchResponse, User } from "./contracts";
import { ApiError } from "./errors";
import { request } from "./http";

export const realApi: PoolrApi = {
  health: () => request("/health", { versioned: false }),
  register: (input) => request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(input) }),
  login: (input) => request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(input) }),
  me: () => request<{ user: User }>("/me"),
  createRide: (input: CreateRideInput) => request("/rides", { method: "POST", body: JSON.stringify(input) }),
  getRide: (id: string) => request<{ success: true; data: Ride }>(`/rides/${id}`),
  listOwnRides: (cursor?: string) => {
    const query = new URLSearchParams({ limit: "10" });
    if (cursor) query.set("cursor", cursor);
    return request<OwnRidesPage>(`/me/rides?${query}`);
  },
  async searchRides(input: SearchInput): Promise<SearchResponse> {
    const query = new URLSearchParams({
      pickupLng: String(input.pickup[0]),
      pickupLat: String(input.pickup[1]),
      maxWalkM: String(input.maxWalkM),
      seats: String(input.seats),
      limit: String(input.limit ?? 20),
    });
    if (input.departAfter) query.set("departAfter", input.departAfter);
    if (input.departBefore) query.set("departBefore", input.departBefore);
    const response = await request<{ results: Array<Ride & { walkPickupM: number }>; truncated: boolean }>(`/rides/search?${query}`);
    return {
      results: response.results.map(({ walkPickupM, ...ride }) => ({ source: "real" as const, ride, walkPickupM })),
      truncated: response.truncated,
      demo: false,
    };
  },
  async bookRide(_input: BookingInput, _idempotencyKey: string): Promise<Booking> {
    throw new ApiError({ status: 501, code: "NOT_IMPLEMENTED", message: "Booking is not available in the current API", details: {} });
  },
  async listBookings(): Promise<Booking[]> { return []; },
  async cancelBooking(): Promise<Booking> {
    throw new ApiError({ status: 501, code: "NOT_IMPLEMENTED", message: "Booking cancellation is not available in the current API", details: {} });
  },
};
