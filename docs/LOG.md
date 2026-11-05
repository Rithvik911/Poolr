# Poolr — Development Log

## 2026-10-19 to 2026-10-20 — Gate 0, S1: MongoDB Transactions

**Time spent:** Not recorded

### Work completed

- Installed WSL 2 and configured Docker Desktop.
- Started MongoDB 7.0.45 in Docker as a single-node replica set (`rs0`).
- Verified the MongoDB node reached PRIMARY state.
- Implemented transaction rollback and commit experiments using Mongoose 9.11.2.
- Tested the consequences of omitting a transaction session.
- Verified replica-set recovery after a container restart.
- Verified initialization from a fresh Docker volume.
- Created ADR-0001 documenting the experiments and proposed design decision.

### Measured results

- Rollback with session: 0 documents remained.
- Successful transaction: 2 documents committed.
- Rollback without session: 2 documents survived.
- Replica-set restart: container returned to healthy status.
- Fresh-volume initialization: PRIMARY state `1`.
- Transactions after fresh initialization: rollback 0, commit 2.
- Mixed-session rollback experiment:
  - Transactional insert: `{ n: 5 }` with the session.
  - Non-transactional insert: `{ n: 6 }` without the session.
  - The transaction was deliberately aborted.
  - Result: `{ n: 5 }` was rolled back; only `{ n: 6 }` remained.
  - Assertions confirmed exactly one surviving document with `n: 6`.
  - The script cleans up the remaining document after verification.


### Lessons learned

- MongoDB transactions only protect operations participating in the transaction.
- Explicit session propagation is necessary for Poolr's transactional repository methods.
- Mongoose 9.11.2 required `ordered: true` for the tested multi-document `create()` operation with a session.
- Tests must verify the intended failure, not merely the expected final document count.
- A database operation executed without the transaction session is not
  protected by that transaction's rollback, even when called inside
  the `withTransaction()` callback.
- The mixed-session scenario is reproducible in
  `spikes/s1-transaction.ts` using `npx tsx spikes/s1-transaction.ts`.


### Next

- Review ADR-0001 and progress evidence.
- Update the Gate 0 S1 checklist.
- Commit the verified S1 work.
- Proceed to S2 only after S1 documentation is complete.
## S2 — 10,000-route geospatial baseline

- Dataset: 10,000 synthetic three-point GeoJSON LineStrings
- Generator seed: 42
- Collection: `poolr.s2benchmark`
- Index: `route_2dsphere`
- MongoDB: 7.0.45
- Environment: Local Docker single-node replica set
- Timing method: Single MongoDB `explain("executionStats")` observation

| Query | Returned | Docs examined | Keys examined | Time |
|---|---:|---:|---:|---:|
| `$geoIntersects` polygon | 125 | 164 | 1,290 | 2 ms |
| `$geoNear` within 3,000 m | 422 | 7,164 | 7,254 | 19 ms |

### Query parameters

- `$geoIntersects` polygon:
  `[80.24,13.04]` to `[80.26,13.06]`
- `$geoNear` point: `[80.25,13.05]`
- `$geoNear` maximum distance: 3,000 meters
- `$geoNear` uses `spherical: true` and `key: "route"`

### Findings

- The `$geoIntersects` winning plan used the
  `route_2dsphere` index (`IXSCAN` followed by `FETCH`).
- `$geoNear` returned 422 routes within the configured distance.
- Documents examined are execution-work counters, not necessarily
  distinct documents.
- The two queries use different selection predicates, so their
  timings are not a controlled head-to-head performance comparison.
- Results are synthetic, local, and based on single measurements.
## S2 — MongoDB Geospatial Route Search

### Objective

Investigate MongoDB's `2dsphere` index for discovering driver routes geographically relevant to a passenger's pickup and drop-off locations.

Evaluate the planned two-circle candidate query, inspect its execution plan, and determine how `$geoNear` measures distance to a LineString.

### Environment

- MongoDB: `7.0.45`
- Replica set: `rs0`, single-node writable primary
- Environment: Local Docker container
- Database: `poolr`
- Collections: `s2benchmark`, `s2benchmark100k`
- Geospatial index: `route_2dsphere`
- Generator seed: `42`
- Datasets: 10,000 and 100,000 synthetic three-point LineStrings

The MongoDB server identity was confirmed using `serverInfo()` and `hello` from the S2 script.

### Original Single-Polygon Experiment

The original `$geoIntersects` query used a rectangular polygon covering approximately `[80.24, 13.04]` to `[80.26, 13.06]`.

The `$geoNear` query used `[80.25, 13.05]`, a 3,000-meter maximum distance, `spherical: true`, and `key: "route"`.

| Query | Dataset | Returned | Docs examined | Keys examined | Examined / returned |
|---|---:|---:|---:|---:|---:|
| `$geoIntersects` | 10k | 125 | 164 | 1,290 | 1.31× |
| `$geoIntersects` | 100k | 1,270 | 1,652 | 13,175 | 1.30× |
| `$geoNear` | 10k | 422 | 7,164 | 7,254 | 16.98× |
| `$geoNear` | 100k | 4,390 | 72,562 | 72,922 | 16.53× |

#### Findings

- The tested `$geoIntersects` query examined approximately 1.3 documents per returned route at both dataset sizes.
- The tested `$geoNear` query examined approximately 71.64% of the 10k collection and 72.56% of the 100k collection.
- Documents examined increased with dataset size partly because more routes matched the same geographic query area.
- The operators used different geographic predicates and returned different result sets. Their execution costs are not a controlled head-to-head comparison.
- The original single-polygon experiment alone did not validate the planned pickup-and-drop-off candidate search.

### Two-Circle Candidate Query

The planned candidate-search query combines two `$geoIntersects` predicates with `$and`.

A route must intersect both a pickup circle and a drop-off circle.

Both circles are generated with Turf.js `circle()` using 64 steps, an experimental 1 km radius, and 1% radius inflation.

The same query coordinates were used across both datasets:

- Pickup: `[80.175704, 12.926438]`
- Drop-off: `[80.173821, 12.896366]`

| Metric | 10k routes | 100k routes |
|---|---:|---:|
| Routes returned | 2 | 27 |
| Documents examined | 52 | 485 |
| Index keys examined | 351 | 3,472 |
| Documents examined / returned | 26.00× | 17.96× |
| Documents examined / dataset size | 0.52% | 0.485% |

#### Findings

- The two-circle query returned candidates on both datasets.
- On the 100k dataset, MongoDB examined 485 documents to return 27 routes.
- The 100k winning plan contained `FETCH → IXSCAN`, using `route_2dsphere`.
- Both geographic predicates were present in the `FETCH` filter.
- The observed plan showed one index scan, not two separate scans joined together.
- These results support selective index-assisted candidate retrieval for this synthetic workload.

### `$geoNear` LineString Distance Experiment

A temporary collection containing three synthetic LineStrings was used to test geographic distance semantics.

The passenger point was placed near the midpoint of one route rather than near either endpoint.

| Route | Reported distance |
|---|---:|
| Near-middle | 111.30 m |
| Far-north | 5,454.64 m |
| Far-south | 5,677.24 m |

The near-middle distance was much smaller than the distance to either endpoint.

This supports nearest-point-on-line distance behavior for the tested MongoDB configuration and geometry.

The temporary collection was deleted after the experiment.

### Reproduction Commands

The following commands rerun the existing seeded benchmarks without inserting new data.

**10k dataset:**

```powershell
$env:S2_DATASET = "10k"
$env:RUN_S2_INSERT = "false"
$env:RUN_S2_BENCHMARK = "true"
npx tsx spikes/s2-geospatial.ts
```

**100k dataset:**

```powershell
$env:S2_DATASET = "100k"
$env:RUN_S2_INSERT = "false"
$env:RUN_S2_BENCHMARK = "true"
npx tsx spikes/s2-geospatial.ts
```

The existing collections must be seeded before running benchmark-only mode.

The winning plan was also examined through `mongosh` using `explain("executionStats")`.

### Limitations

- The datasets use synthetic three-point routes rather than realistic road networks.
- Longer and more complex routes may have different index selectivity.
- Only a limited set of geographic query locations has been investigated.
- Geospatial intersections do not establish correct pickup/drop-off ordering.
- Geographic proximity does not measure actual walking or driving distances.
- Reported execution times vary between runs and are not statistically rigorous benchmarks.
- Concurrent workloads, repeated-trial statistics, and p95/p99 latency measurements remain untested.
- No production scalability claim is supported by these experiments.

### Next Steps

- Evaluate realistic route shapes and pickup/drop-off distributions in v0.2.
- Integrate geographic candidate retrieval with Turf.js route-positioning checks.
- Benchmark longer routes and repeated query workloads.
- Revisit candidate retrieval if real-world route geometries produce excessive document examination.
- Continue resolving the remaining Gate 0 review findings.

## S3 — Route Positioning with Turf.js

### Objective

Investigate how to project passenger pickup and drop-off locations onto a driver's route, evaluate their order along the route, and handle overlapping or looping geometries.

### Implementation

- Used Turf.js `nearestPointOnLine()` to calculate geographic proximity and position along a route.
- Evaluated individual LineString segments to identify multiple possible visits to the same location.
- Accumulated segment lengths to determine positions along the complete route.
- Implemented proximity filtering with an experimental 1 km threshold.
- Added a 100 m minimum journey-length threshold.
- Deduplicated projections at shared segment boundaries using a 1 mm tolerance.
- Added input checks and handling for zero-length segments.

### Test Results

All 20 automated assertions passed, covering:

- Forward and reverse travel direction
- Identical pickup and drop-off
- Distant passenger rejection
- Overlapping segments and repeated visits
- Looping-route ordering
- Shared-boundary deduplication
- Zero-length and degenerate segments
- Invalid coordinates
- Minimum journey distance
- Multi-turn routes
- Regression: a later route visit can prevent a false-negative match
  when the first drop-off projection occurs before pickup.
- Proximity boundary: a passenger 0.99 km from the route is accepted.
- Proximity boundary: a passenger 1.01 km from the route is rejected.

### Key Findings

- Turf's `totalDistance` property provides distance along a LineString from its beginning.
- A single `nearestPointOnLine()` projection may miss later visits on looping routes.
- Examining each segment separately allows multiple route positions to be considered.
- Distinct segment projections can represent the same route position and require deduplication.
- Geometric ordering and proximity checks can reject unsuitable candidates, but do not establish real-world ride feasibility.

### Limitations

- Synthetic geometries do not represent actual road routes.
- Geographic proximity does not measure driving distance or detour time.
- The 1 km proximity, 100 m journey, and 1 mm deduplication thresholds are experimental.
- Large-scale performance and road-network behavior have not been evaluated.
- Passing 20 targeted tests does not establish production correctness.
- The proximity tests cover points just inside and outside the 1 km
  threshold, not exact-boundary floating-point behavior.
- The regression demonstrates a first-projection false negative;
  it does not establish Turf's whole-route tie-breaking behavior.
- The experiment verifies whether a valid projection pair exists,
  but does not select an optimal pair deterministically.

### Next

Document the architectural implications in ADR-0003 and review the S3 implementation before merging.



## S4 — Concurrent Booking Consistency

### Objective

Investigate race conditions in seat reservations and evaluate
strategies for maintaining booking consistency under concurrent
requests.

### Environment

- MongoDB 7 running in a local Docker single-node replica set.
- Mongoose 9.11.2 with TypeScript and Node.js.
- Experiment: `spikes/s4-concurrent-booking.ts`.
- Concurrent booking attempts: 50.
- Initial available seats: 1, except in the duplicate-booking
  experiment, which uses 2 seats.
- Dedicated experimental ride and booking collections.

### Implementation

Five experiments were implemented:

1. Unsafe read-then-write booking using a deliberately widened
   race window and a non-conditional `$set` update.
2. Atomic reservation using `findOneAndUpdate()` with
   `availableSeats: { $gt: 0 }` and `$inc`.
3. Transaction rollback after a deliberately injected failure
   following the seat decrement.
4. Concurrent transactional reservations using `withTransaction()`
   and `Promise.allSettled()`.
5. Duplicate-booking prevention using a compound unique index
   on `(rideId, passengerId)`.

### Observed Results

| Experiment | Observation | Result |
|---|---|---|
| Unsafe booking | 50 bookings for 1 seat; 0 seats remaining | Overbooking reproduced |
| Atomic reservation | 1 booking for 1 seat; 0 seats remaining | Assertions passed |
| Transaction rollback | 1 seat remaining; 0 bookings | Assertions passed |
| Concurrent transactions | 50 attempts, 1 successful booking, 0 rejected promises, 0 seats remaining | Invariants passed |
| Duplicate prevention | 1 successful request, 1 E11000 rejection, 1 booking, 1 seat remaining | Assertions passed |

These observations describe the recorded local execution, not
guaranteed outcomes of every concurrent run.

### Verified Invariants

- Confirmed booking count must not exceed initial seat capacity.
- Available seats plus committed bookings must equal initial capacity.
- Successful reservation results must correspond to committed
  booking records in the tested execution.
- A failed transactional booking must not permanently consume a seat.
- A passenger must not have two booking records for the same ride
  when the compound unique index is enforced.

### Key Findings

- Reading availability and writing it later is unsafe under
  concurrent requests.
- Atomic conditional updates prevent competing requests from
  decrementing the same final seat.
- A conditional update alone does not atomically couple seat
  reservation with booking-record creation.
- MongoDB transactions allow the seat decrement and booking insert
  to commit or roll back together.
- Transactions alone do not enforce uniqueness of passenger-ride
  bookings.
- A compound unique index provides database-enforced duplicate
  prevention.
- Duplicate prevention and request idempotency are distinct concerns.

### Verification

Executed:

`npx tsx spikes/s4-concurrent-booking.ts`

Type checking passed using:

`npx tsc --noEmit --target es2022 --module nodenext --moduleResolution nodenext --esModuleInterop --types node spikes/s4-concurrent-booking.ts`

### Limitations

- The experiments use local MongoDB and synthetic concurrent requests.
- Only one observed execution is documented in the results table.
- The unsafe experiment is intentionally nondeterministic.
- The atomic-only strategy does not protect against booking-insert
  failure after a successful seat decrement.
- The experiments do not establish behavior under process crashes,
  network partitions, or ambiguous transaction commit outcomes.
- Explicit application-level retry and idempotency policies remain
  future work.
- A unique `(rideId, passengerId)` index enforces one booking record
  per passenger per ride; cancellation and rebooking rules must be
  considered separately.
- Passing these experiments does not establish production readiness.

### Next

- Record the architectural implications in ADR-0004.
- Review error handling, transaction retries, and test reproducibility.
- Prepare the S4 experiment for pull-request review.

## v0.1 — Express and TypeScript Backend Foundation

**Branch:** `feat/v0.1-backend-foundation`
**Commit:** `65e22f5`
**Status:** Initial backend foundation implemented and locally verified.

### Objective

Establish a TypeScript-based Express backend for Poolr, reusing the MongoDB infrastructure validated during Gate 0.

### Implementation

- Installed Express 5 and its TypeScript declarations.
- Created `src/app.ts` to configure the Express application and JSON parsing middleware.
- Created `src/server.ts` to load environment variables, establish the database connection, and start the HTTP server.
- Created `src/config/database.ts` to manage the Mongoose connection.
- Added strict TypeScript configuration in `tsconfig.json`.
- Added `npm run dev` using `tsx watch` for automatic server restarts.
- Implemented `GET /health` as the initial API endpoint.

### Verification

- MongoDB Docker container reported healthy.
- Mongoose connected successfully.
- Express started on port 3000.
- `GET /health` returned HTTP 200 with `{"status":"ok","service":"Poolr API"}`.
- `npx tsc --noEmit` passed without reported errors.
- Git working tree was clean after commit `65e22f5`.

### Architectural Decisions

The Express application configuration is separated from server startup to support modular routing and future API testing.

The backend establishes a MongoDB connection before opening the HTTP listener. Environment variables are loaded from `.env`, which is excluded from version control.

Gate 0 experiments remain isolated in `spikes/` and are not treated as production implementations.

### Current Limitations

- No user authentication or authorization.
- No ride-management APIs.
- No automated backend test suite.
- The health endpoint confirms HTTP responsiveness but does not independently test database readiness on each request.
- Graceful shutdown and runtime database disconnection handling are not yet implemented.

### Next Steps

Implement user registration, password hashing, login, JWT-based authentication, request validation, and automated authentication tests.
## v0.1 — User Registration

**Branch:** `feat/v0.1-backend-foundation`
**Status:** Registration implemented and manually verified; commit pending.

### Implementation

- Added the Mongoose User model with unique email indexing.
- Added Zod validation for registration requests.
- Implemented bcrypt password hashing with cost factor 12.
- Implemented the registration service and controller.
- Added the `POST /auth/register` endpoint.
- Added HTTP 409 handling for existing emails and MongoDB email duplicate-key errors.
- Registration responses exclude plaintext passwords and password hashes.

### Verification

- `npx tsc --noEmit` passed.
- New user registration returned HTTP 201.
- Duplicate registration returned HTTP 409.
- MongoDB's `users` collection was verified.
- Unique index `email_1` with `unique: true` was verified.
- Two parallel registration requests returned HTTP 201 and HTTP 409.
- MongoDB contained exactly one user document for the tested email.

### Limitations

- Concurrent-registration testing covered a small number of requests, not exhaustive stress testing.
- Automated integration tests have not yet been implemented.
- Login, JWT authentication, and protected routes remain pending.

### Next Steps

- Add repeatable automated registration tests.
- Implement login and password verification.
- Add JWT-based authentication and protected endpoints.


## v0.1 — Login and JWT Authentication

### Implemented
- Login validation using Zod
- User lookup with Mongoose
- Password verification using bcrypt.compare()
- JWT generation with HS256 and 15-minute expiry
- JWT authentication middleware
- Protected GET /auth/me endpoint
- User profile retrieval from MongoDB

### Architecture
POST /auth/login
→ Login Controller
→ Auth Service
→ bcrypt verification
→ JWT generation

GET /auth/me
→ requireAuth middleware
→ JWT verification
→ getMeController
→ MongoDB user lookup
→ Profile response

### Verification
- Successful login: 200 OK
- Invalid credentials: 401 Unauthorized
- Valid JWT: protected profile returned
- Missing JWT: rejected
- Invalid JWT: rejected

### Key Learnings
- JWTs contain a header, payload, and signature.
- The JWT secret remains on the backend.
- Clients send access tokens using the Bearer scheme.
- jwt.verify() validates the signature and expiry.
- res.locals shares request-specific data with controllers.
- Authentication identifies users; authorization controls permissions.

### Current Limitations
- No refresh-token mechanism
- No token revocation or logout mechanism
- No login rate limiting
- Authentication tests are manual, not automated

## Step 273 — Inspect Git changes

In your Poolr project directory, run:

```powershell
git status --short
git diff --check
```

Then check whether `.env` is tracked:

```powershell
git ls-files .env
```

**That last command should produce no output.** We must not commit your actual `JWT_SECRET`.

Once the checks look good, we'll stage the specific files and create:

```text
feat: implement login and JWT authentication
```

**Your next action, mate:** Update `docs/LOG.md`, run those three Git commands, and paste the output. Then we'll commit safely! 💪

## 2026-11-02 to 2026-11-05 — v0.1 Ride Creation

**Branch:** `feat/v0.1-ride-creation`
**Time spent:** Not recorded
**Status:** Implemented and locally verified; commit pending.

### Work completed

- Added `isDriver` as a user capability while retaining passenger access for every user.
- Included `isDriver` in registration, login, and current-user responses.
- Added the Ride model with driver ownership, lifecycle status, GeoJSON route, derived route length, departure time, seat counts, price in paise, and timestamps.
- Made driver, route geometry, route length, departure, total seats, and price immutable through Mongoose.
- Added strict Zod validation for ride-creation requests and rejected server-controlled fields.
- Added the ride-creation service with driver authorization, deterministic time-boundary checks, Turf route-length calculation, and server-derived seat availability.
- Added authenticated `POST /rides` routing and response formatting for INR.
- Added derived `origin` and `destination` response fields without storing redundant route endpoints.
- Added an idempotent MongoDB migration for the Ride collection validator and indexes.
- Disabled Mongoose automatic index creation in production connections.
- Added an explicit unique `users.email` index to the migration because production no longer relies on automatic indexing.
- Added service, validator, and HTTP integration tests for ride creation.

### Verified behavior

- Route coordinate count is limited to 2–500.
- Coordinates use `[longitude, latitude]` and stay within the supported envelope.
- Consecutive duplicate points and antimeridian crossings are rejected.
- Non-consecutive repeated coordinates remain valid for looping routes.
- Route length must be at least 500 metres.
- Departure is accepted from exactly 5 minutes through exactly 90 days in the future.
- Seats are integer values from 1 through 8.
- Price is integer paise from 0 through 1,000,000.
- Passenger-only users cannot create rides.
- Client requests cannot control ownership, status, available seats, route length, or timestamps.
- Immutable Ride fields resist update attempts, while status and available seats remain mutable for future lifecycle operations.

### Database evidence

- The migration ran successfully twice, confirming idempotent behavior.
- Verified Ride indexes:
  - `_id_`
  - `route_2dsphere`
  - `status_1_departureTime_1`
  - `driverId_1_departureTime_-1`
- Verified `users.email_1` exists with `unique: true`.
- A direct invalid write with `seatsAvailable: 3` and `seatsTotal: 2` failed with MongoDB document-validation error code 121.

### Automated verification

- Application type-check passed: `npx tsc --noEmit`.
- Test type-check passed: `npm run test:typecheck`.
- Migration type-check passed using the standalone TypeScript command recorded during the session.
- Full suite passed: 8 test files, 72 tests.
- `git diff --check` reported no whitespace errors.

### Current limitations

- The endpoint is currently `POST /rides`; the authoritative API contract requires the `/v1` prefix.
- Ride retrieval, driver ride listing, cursor pagination, and pickup-only search remain unimplemented.
- Shared `Clock`, centralized `AppError` handling, request IDs, Pino logging, and `/ready` remain pending.
- Authentication still uses bcrypt rather than the specified Argon2id and does not yet include `USER | ADMIN` roles.
- The migration is locally verified but is not yet exercised automatically in CI.

### Next

- Review and commit the Ride Creation checkpoint through a pull request.
- Implement `GET /rides/:id` and `GET /me/rides` with cursor pagination.
- Implement pickup-only ride search.
- Continue the remaining v0.1 infrastructure and acceptance checklist.
