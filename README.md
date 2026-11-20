# Poolr

[![CI](https://github.com/Rithvik911/Poolr/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Rithvik911/Poolr/actions/workflows/ci.yml)

Poolr is a carpooling backend built with Node.js, TypeScript, Express, MongoDB, Mongoose, Zod, and Turf. Drivers publish rides with GeoJSON routes, and later milestones add route-aware search, concurrency-safe booking, and batch matching.

The project is under active development. Claims in this README describe only behavior currently backed by tests or recorded experiments.

## What's built

- Express application with JSON request parsing and a public health endpoint.
- Environment validation for MongoDB and JWT configuration.
- User registration with normalized email and hashed passwords.
- Login with JWT access tokens, generic credential failures, and IP-based rate limiting.
- Protected current-user endpoint.
- Driver capability through `isDriver`.
- Authenticated Ride creation with:
  - GeoJSON `LineString` routes in `[longitude, latitude]` order
  - 2–500 coordinates
  - support for looping routes
  - rejection of consecutive duplicate points and antimeridian crossings
  - server-derived route length using Turf
  - origin and destination derived from the first and last route coordinates
  - departure from 5 minutes through 90 days in the future
  - 1–8 seats
  - integer INR pricing in paise
  - server-controlled ownership, status, and available seats
- Authenticated Ride retrieval by ID with malformed-ID and not-found handling.
- Authenticated driver Ride listing with owner-scoped, stable cursor pagination.
- Authenticated pickup-only Ride search with safe geographic candidate filtering, exact Turf walking distance, and deterministic ranking.
- Explicit MongoDB migration for Ride indexes, seat validation, and unique user email indexing.
- Unit and integration coverage for authentication, rate limiting, request validation, Ride business rules, persistence rules, and HTTP behavior.

Current local verification: **12 test files and 131 tests passing**.

## Requirements

- Node.js
- npm
- Docker Desktop with Docker Compose

## Local setup

Install dependencies:

```powershell
npm ci
```

Create the local environment file:

```powershell
Copy-Item .env.example .env
```

Replace the example JWT secret in `.env` with a strong local secret.

Start MongoDB:

```powershell
docker compose up -d
docker compose ps
```

Apply database indexes and validators:

```powershell
npm run db:migrate
```

Start the API in watch mode:

```powershell
npm run dev
```

## Verification

Type-check application code:

```powershell
npx tsc --noEmit
```

Type-check tests:

```powershell
npm run test:typecheck
```

Run all automated tests:

```powershell
npm test
```

## Current endpoints

- `GET /health`
- `GET /ready`
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `GET /v1/me`
- `POST /v1/rides`
- `GET /v1/rides/search?pickupLng=77.5946&pickupLat=12.9716`
- `GET /v1/rides/:id`
- `GET /v1/me/rides?limit=10&cursor=...`

## Roadmap

### v0.1

- Add structured Pino logging and a shared Clock.
- Complete authentication roles and guards.
- Complete fresh-clone verification.

### Later milestones

- v0.2: full route-aware pickup/drop-off search and correctness benchmarks.
- v0.3: transactional, idempotent, concurrency-tested booking.
- v0.4: flexible ride requests and deterministic batch matching.
- v0.5: Redis experiments, rate limiting, and load testing.
- v1.0: OpenAPI, refresh-token rotation, deployment, and portfolio polish.

## Current limitations

- No payments, chat, live tracking, notifications, ratings, or client application.
- Search is pickup-only; drop-off matching and route-order checks remain v0.2 work.
- Walking distance is straight-line Turf distance, not pedestrian road-network distance.
- Booking flows are not yet implemented.
- Benchmarks use synthetic data and do not represent production traffic.
- Pre-Sprint-2 unversioned route aliases are intentionally unsupported and return the standard 404 error envelope.
- Authentication currently uses bcrypt; the specification targets Argon2id before v0.1 completion.

See `docs/versions.md` for the complete milestone checklist and `docs/LOG.md` for recorded implementation evidence.
