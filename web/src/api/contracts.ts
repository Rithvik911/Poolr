export type Coordinate = [longitude: number, latitude: number];

export interface User {
  id: string;
  name: string;
  email: string;
  isDriver: boolean;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export type RideStatus = "SCHEDULED" | "STARTED" | "COMPLETED" | "CANCELLED";

export interface Ride {
  id: string;
  driverId: string;
  status: RideStatus;
  route: { type: "LineString"; coordinates: Coordinate[] };
  origin: Coordinate;
  destination: Coordinate;
  routeLengthM: number;
  departureTime: string;
  seatsTotal: number;
  seatsAvailable: number;
  pricePerSeatPaise: number;
  currency: "INR";
  priceDisplay: string;
}

export interface CreateRideInput {
  route: { type: "LineString"; coordinates: Coordinate[] };
  departureTime: string;
  seatsTotal: number;
  pricePerSeatPaise: number;
}

export interface OwnRidesPage {
  success: true;
  data: Ride[];
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null };
}

export interface SearchInput {
  pickup: Coordinate;
  dropoff?: Coordinate;
  maxWalkM: number;
  seats: number;
  departAfter?: string;
  departBefore?: string;
  limit?: number;
}

export type SearchItem =
  | { source: "real"; ride: Ride; walkPickupM: number }
  | {
      source: "demo";
      ride: Ride;
      walkPickupM: number;
      walkDropoffM: number;
      pickupOffsetM: number;
      dropoffOffsetM: number;
      tripDistanceM: number;
      priceDisplay: string;
    };

export interface SearchResponse {
  results: SearchItem[];
  truncated: boolean;
  demo: boolean;
}

export interface BookingInput {
  rideId: string;
  seats: number;
  pickup: { lng: number; lat: number };
  dropoff: { lng: number; lat: number };
}

export interface Booking {
  id: string;
  rideId: string;
  seats: number;
  status: "CONFIRMED" | "CANCELLED";
  farePaise: number;
  createdAt: string;
  demo: true;
}

export interface PoolrApi {
  health(): Promise<{ status: string; service: string }>;
  register(input: { name: string; email: string; password: string; isDriver: boolean }): Promise<AuthResponse>;
  login(input: { email: string; password: string }): Promise<AuthResponse>;
  me(): Promise<{ user: User }>;
  createRide(input: CreateRideInput): Promise<{ success: true; message: string; data: Ride }>;
  getRide(id: string): Promise<{ success: true; data: Ride }>;
  listOwnRides(cursor?: string): Promise<OwnRidesPage>;
  searchRides(input: SearchInput): Promise<SearchResponse>;
  bookRide(input: BookingInput, idempotencyKey: string): Promise<Booking>;
  listBookings(): Promise<Booking[]>;
  cancelBooking(id: string): Promise<Booking>;
}
