# Poolr web contract decisions

This file records the contracts verified against the merged backend API contract and the frontend implementation. It is derived from the Express route registration, controllers, Zod validators, services, response mapper, integration tests, architecture notes, and README. It deliberately overrides older planning text when the implementation and tests disagree with it.

## API location

- `VITE_API_BASE_URL` is the configurable origin. It defaults to an empty string so Vite's development proxy can keep browser requests same-origin.
- `VITE_API_PREFIX` is the configurable application prefix. It defaults to `/v1`.
- `/health` and `/ready` are operational endpoints and are deliberately not prefixed.
- The active implementation does **not** retain unversioned aliases. `/auth/login`, `/rides`, and similar old paths return the normal `404 NOT_FOUND` envelope.

All protected requests use `Authorization: Bearer <accessToken>`. Access tokens currently expire after 60 minutes. Coordinates are always `[longitude, latitude]`.

## Shared success types

```ts
type User = {
  id: string;
  name: string;
  email: string;
  isDriver: boolean;
};

type Ride = {
  id: string;
  driverId: string;
  status: "SCHEDULED" | "STARTED" | "COMPLETED" | "CANCELLED";
  route: { type: "LineString"; coordinates: [number, number][] };
  origin: [number, number];
  destination: [number, number];
  routeLengthM: number;
  departureTime: string; // ISO UTC
  seatsTotal: number;
  seatsAvailable: number;
  pricePerSeatPaise: number;
  currency: "INR";
  priceDisplay: string; // currently `₹${(paise / 100).toFixed(2)}`
};
```

## Shared error contract

The active application returns:

```ts
{
  error: {
    code: string;
    message: string;
    details: unknown; // `{}` when no safe details exist
    requestId: string;
  }
}
```

The same request ID is returned in `X-Request-Id`. Malformed JSON is `400 VALIDATION_ERROR`; unmatched routes are `404 NOT_FOUND`; unexpected errors are `500 INTERNAL` without stack traces or internal messages.

The web client also normalizes the earlier `{ success: false, message: string }` shape because older backend branches still use it.

## Endpoints present today

### `GET /health`

Public liveness probe. It does not depend on MongoDB.

```ts
// 200
{ status: "ok"; service: "Poolr API" }
```

### `GET /ready`

Public readiness probe.

```ts
// 200 when Mongoose is connected
{ status: "ready"; service: "Poolr API"; checks: { mongo: "up" } }

// 503 otherwise, in the shared error envelope
// code: "SERVICE_BUSY", message: "Service is not ready"
// details: { checks: { mongo: "down" } }
```

### `POST /v1/auth/register`

Public.

```ts
// body (Zod object is not strict at this endpoint)
{
  name: string;      // trimmed, 2..100 characters
  email: string;     // valid email, trimmed and lowercased
  password: string;  // min 8 characters, max 72 UTF-8 bytes
  isDriver?: boolean;// defaults to false
}

// 201
{ user: User; accessToken: string }
```

Known failures: `400 VALIDATION_ERROR` (`Invalid registration data`), `409 EMAIL_TAKEN` (`Email already registered`), and the shared internal error.

### `POST /v1/auth/login`

Public, limited to 10 attempts per IP in a fixed 15-minute window. The 11th attempt returns 429. All attempts reaching the route count, including malformed bodies.

```ts
// body
{ email: string; password: string }

// 200
{ user: User; accessToken: string }
```

Known failures: `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS` with the intentionally generic `Invalid email or password`, and `429 RATE_LIMITED` (`Too many login attempts. Please try again later.`).

### `GET /v1/me`

Protected.

```ts
// 200
{ user: User }
```

Known failures: `401 UNAUTHENTICATED` for missing, malformed, invalid, or expired credentials; `404 NOT_FOUND` if the token's user no longer exists.

### `POST /v1/rides`

Protected and requires `user.isDriver === true`.

```ts
// strict body
{
  route: {
    type: "LineString";
    coordinates: [number, number][]; // 2..500 points
  };
  departureTime: string; // ISO timestamp with an offset
  seatsTotal: number; // integer 1..8
  pricePerSeatPaise: number; // integer 0..1_000_000
}

// 201
{ success: true; message: "Ride created successfully"; data: Ride }
```

The server derives owner, status, available seats, origin, destination, and route length. It rejects consecutive duplicate points and antimeridian crossings. Loops are allowed. Route length must be at least 500 m. Departure must be from exactly 5 minutes through exactly 90 days in the future.

Known failures: `401 UNAUTHENTICATED`, `403 FORBIDDEN` for a non-driver, and `400 VALIDATION_ERROR` for invalid bodies, dates, or a route shorter than 500 m.

### `GET /v1/rides/:id`

Protected.

```ts
// 200
{ success: true; data: Ride }
```

Known failures: `400 VALIDATION_ERROR` for a malformed Mongo ObjectId, `404 NOT_FOUND` for a missing ride, and `401 UNAUTHENTICATED`.

### `GET /v1/me/rides`

Protected. Contrary to the older task snapshot, this endpoint exists today.

```ts
// strict query
{ limit?: string; cursor?: string }
// limit defaults to 10 and accepts canonical integers 1..50

// 200
{
  success: true;
  data: Ride[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}
```

Results belong only to the authenticated driver and are ordered by `departureTime` descending, then ID descending. The opaque Base64URL cursor is navigation state, not authorization.

### `GET /v1/rides/search`

Protected. Contrary to the older task snapshot, pickup-only search exists today. The fixed `/search` route is registered before `/:id`.

```ts
// strict query; every value arrives as a string
{
  pickupLng: string; // decimal -180..180, required
  pickupLat: string; // decimal -60..60, required
  maxWalkM?: string; // integer 1..3000, default 1000
  departAfter?: string; // ISO timestamp with offset, default now
  departBefore?: string; // ISO timestamp with offset, default +24 h
  seats?: string; // integer 1..8, default 1
  limit?: string; // integer 1..50, default 20
}

// 200
{
  results: Array<Ride & { walkPickupM: number }>;
  truncated: boolean;
}
```

The departure window is inclusive, ordered, and no longer than seven days. Search excludes the requester's rides, requires `SCHEDULED` status and enough seats, calculates exact straight-line pickup distance with Turf, and ranks by full-precision pickup walk, departure, then ride ID. The returned walk is rounded to two decimals. It does **not** support drop-off fields, pickup-before-drop-off ordering, pedestrian routing, or road-network walking distance.

## Not present today

- Booking create/list/get/cancel endpoints
- Ride lifecycle start/complete/cancel endpoints
- Drop-off-aware route search
- Flexible requests and batch matching
- A last-seat race endpoint
- Payments, chat, ratings, navigation, notifications, or live tracking

These surfaces are hidden or explicitly labelled demo-only. `VITE_USE_MOCKS=true` switches search, my-rides, and booking-oriented screens to the in-memory adapter. Real auth, create-ride, get-ride, health, and profile calls remain real.

## Mock-only final-spec contracts

Mock search returns:

```ts
{
  results: Array<{
    ride: Ride;
    walkPickupM: number;
    walkDropoffM: number;
    pickupOffsetM: number;
    dropoffOffsetM: number;
    tripDistanceM: number;
    priceDisplay: string;
  }>;
  truncated: boolean;
}
```

Mock booking accepts `POST rides/:id/bookings` semantics with body `{ seats, pickup: {lng,lat}, dropoff: {lng,lat} }` and one UUID `Idempotency-Key` per user attempt. A retry after a network failure or `503 SERVICE_BUSY` reuses that key; a fresh attempt creates a new key.

Specific mock/future errors handled in UI: `SEATS_UNAVAILABLE`, `RIDE_NOT_BOOKABLE`, `OWN_RIDE`, `DUPLICATE_BOOKING`, `PICKUP_DROPOFF_NOT_ON_ROUTE` (422), `IDEMPOTENCY_KEY_REUSED`, `RATE_LIMITED` (429), and `SERVICE_BUSY` (503, including `retrySafeWithSameKey`).

## Assumptions and configurable unknowns

1. The merged `/v1` contract is the intended frontend target because it is exercised by 139 passing tests and documented as the active API. Prefix and origin remain environment-controlled for older branches.
2. Vite proxies the configured prefix to `http://localhost:3000` during development. This avoids changing backend behavior or adding CORS. If the frontend is served from another origin without the proxy, CORS must be enabled separately.
3. `VITE_MAP_STYLE_URL` is optional. Without it, MapLibre uses a deliberately blank local style with plotted routes and an explicit “basemap not configured” note. A deployment should provide a licensed style URL whose style metadata includes required attribution. The app does not default to public OSM raster tiles.
4. `VITE_USE_MOCKS` defaults to `false`. Demo-only screens explain how to enable mocks rather than silently fabricating data.
5. There is no driver name in Ride responses. The UI says “Poolr driver” instead of inventing an identity.
6. There is no vehicle metadata, rating, meeting-point name, road route, or booking state in current responses; those are not inferred.
7. Benchmark file names and schemas are not defined. The under-the-hood page looks for `/bench/manifest.json`; missing or invalid data produces a no-results state and never substitutes made-up numbers.

## Ambiguities

- The README and older branch notes describe unversioned paths and legacy error shapes, while the active code rejects them. The client normalizer covers both error shapes, but path selection is controlled only by `VITE_API_PREFIX` to prevent silent fallback between APIs.
- The prompt calls search and own-rides “not built yet,” but both are implemented and tested in the active tree. The real adapter therefore uses them by default.
- The final drop-off search and booking shapes are specified, but their pagination, booking response shape, cancellation shape, and my-bookings response are not. Those remain mock-internal types and are not presented as backend promises.
