import type { Booking, BookingInput, Coordinate, OwnRidesPage, PoolrApi, Ride, SearchInput, SearchResponse } from "./contracts";
import { ApiError } from "./errors";
import { formatInr } from "../lib/format";

const routeA: Coordinate[] = [[77.5665, 12.9915], [77.5798, 12.985], [77.5946, 12.9716], [77.6101, 12.967], [77.6408, 12.9698]];
const routeB: Coordinate[] = [[77.552, 12.978], [77.575, 12.974], [77.603, 12.97], [77.626, 12.956]];

function demoRide(id: string, route: Coordinate[], hours: number, seats: number, paise: number): Ride {
  const departure = new Date(Date.now() + hours * 3_600_000).toISOString();
  return {
    id, driverId: `demo-driver-${id}`, status: "SCHEDULED",
    route: { type: "LineString", coordinates: route }, origin: route[0]!, destination: route.at(-1)!,
    routeLengthM: id === "demo-1" ? 9200 : 7400, departureTime: departure,
    seatsTotal: 4, seatsAvailable: seats, pricePerSeatPaise: paise, currency: "INR", priceDisplay: formatInr(paise),
  };
}

const rides = [demoRide("demo-1", routeA, 2, 3, 14000), demoRide("demo-2", routeB, 4, 2, 9500)];
const bookings: Booking[] = [];
const idempotency = new Map<string, Booking>();

export const mockRideApi: Pick<PoolrApi, "listOwnRides" | "searchRides" | "bookRide" | "listBookings" | "cancelBooking"> = {
  async listOwnRides(): Promise<OwnRidesPage> {
    return { success: true, data: rides, pagination: { limit: 10, hasMore: false, nextCursor: null } };
  },
  async searchRides(input: SearchInput): Promise<SearchResponse> {
    const available = rides.filter((ride) => ride.seatsAvailable >= input.seats);
    return {
      results: available.map((ride, index) => ({
        source: "demo" as const, ride,
        walkPickupM: 240 + index * 170, walkDropoffM: 310 + index * 120,
        pickupOffsetM: 1800 + index * 700, dropoffOffsetM: 7200 - index * 400,
        tripDistanceM: 5400 + index * 900, priceDisplay: ride.priceDisplay,
      })),
      truncated: false,
      demo: true,
    };
  },
  async bookRide(input: BookingInput, key: string): Promise<Booking> {
    const replay = idempotency.get(key);
    if (replay) return replay;
    const ride = rides.find((candidate) => candidate.id === input.rideId);
    if (!ride) throw new ApiError({ status: 404, code: "NOT_FOUND", message: "Ride not found", details: {} });
    if (ride.seatsAvailable < input.seats) throw new ApiError({ status: 409, code: "SEATS_UNAVAILABLE", message: "Not enough seats", details: {} });
    ride.seatsAvailable -= input.seats;
    const booking: Booking = {
      id: crypto.randomUUID(), rideId: ride.id, seats: input.seats, status: "CONFIRMED",
      farePaise: ride.pricePerSeatPaise * input.seats, createdAt: new Date().toISOString(), demo: true,
    };
    bookings.unshift(booking);
    idempotency.set(key, booking);
    return booking;
  },
  async listBookings() { return [...bookings]; },
  async cancelBooking(id: string) {
    const booking = bookings.find((candidate) => candidate.id === id);
    if (!booking) throw new ApiError({ status: 404, code: "NOT_FOUND", message: "Booking not found", details: {} });
    booking.status = "CANCELLED";
    return booking;
  },
};
