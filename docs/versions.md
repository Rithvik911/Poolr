# Poolr: version plan

A carpooling backend. Drivers post rides with a route, departure time and seats. Riders search by pickup and drop-off and book seats. Search is route-aware, booking is safe under concurrency, and a batch matcher assigns flexible requests to rides.

**Stack:** Node.js (LTS), TypeScript (strict), Express, zod, pino, MongoDB single-node replica set + Mongoose, turf.js, Redis (from v0.5), Vitest, Supertest, fast-check, k6, Docker Compose, GitHub Actions.

**Budget:** about 180 hours at 20 h/week (9 weeks), plus a 2 to 3 week buffer.

---

## Rules for every tag

- Work on a feature branch, merge by PR, use conventional commits. `main` stays green.
- At each tag: CI is green, a fresh clone runs, the README's "What's built" lists only tested features, and you can explain every file you added.
- Benchmarks record seed, machine and commands, and are labelled synthetic.
- Money is integer paise, currency `INR`, displayed as rupees (for example `₹120.00`).
- **CI tiers:**
  - Every PR: lint, type-check, unit and integration tests, the 20-iteration race matrix, a short model-based run.
  - Nightly and pre-tag: the 200-iteration race matrix, long model-based sequences, the 200 and 500 contention probes. "Green at 200 iterations" means the pre-tag run.
- Review points: after Gate 0 and after v0.3.

---

## Gate 0: Spikes (~10 h, week 1)

- [x] S1: transaction commit and rollback, including the missing-session failure
- [ ] S2: `$geoIntersects` on LineStrings, `$geoNear` distance semantics, 10k and 100k scaling table (docs examined vs results returned)
- [ ] S3: Turf along-route position (version-safe), including reversed and looping routes
- [ ] S4: 50-way contention probe, then 200 and 500
- [x] Replica set works from a clean volume and after a restart

**Done when:** four ADRs are committed (transactions, geo candidate stage, along-route position, replica-set setup), and the design is confirmed or changed based on what you measured.

---

## v0.1: Foundations (~30 h, weeks 1-2)

**Build**
- [ ] Tooling: strict TypeScript, ESLint, Prettier, Husky, commitlint, `.env.example`
- [ ] Compose with replica-set Mongo, plus a migration script for collections, indexes and validators (autoIndex off)
- [ ] Validated config, pino with request IDs, `Clock`, `AppError` hierarchy, central error handler
- [ ] `/health` and `/ready`
- [ ] Auth: register (normalized email, Argon2id), login (generic error), 60-minute access token, user/driver/admin guards, `GET /me`
- [ ] Rides:
  - [ ] Create validates 2 to 500 points, no consecutive duplicate points (loops allowed), route length of at least 500 m, no antimeridian crossing, departure 5 minutes to 90 days ahead, 1 to 8 seats, price 0 to 1,000,000 integer paise
  - [ ] Origin, destination and length derived on the server; responses include `currency` and `priceDisplay`
  - [ ] `GET /rides/:id`, `GET /me/rides` (cursor), pickup-only search
- [ ] Integration tests for every endpoint (success, validation, authz); keep the S1 rollback test as a regression test

**Acceptance**
- [ ] Coverage at least 70%
- [ ] CI green against a replica-set Mongo
- [ ] Fresh clone runs; README has run instructions
- [ ] Tag `v0.1`

---

## v0.2: Route-aware search (~20 h, week 3)

**Build**
- [ ] Pure `evaluateRoute` in `domain/geo`: walks, along-route positions, order, 200 m minimum trip; one adapter file for Turf's property names
- [ ] Two-circle candidate stage with an inflated radius, ordered by departure then `_id`, fetching 501 and returning 500 with `truncated: true`
- [ ] Full search endpoint: optional drop-off, time window, seats, limit (max 50), ranked by total walk, then departure, then `_id`
- [ ] Seeded generator (10k and 100k rides)
- [ ] Three variants: naive scan, capped `$geoNear`, two-circle search
- [ ] Equality oracle, benchmark harness, saved `explain` output
- [ ] Index comparison (`{route}` vs compound), decided by measurement

**Acceptance**
- [ ] Two-circle search returns exactly the naive scan's result set on 1,000 queries at both sizes, cap disabled
- [ ] Edge cases covered: pickup-only and pickup-plus-drop-off, reversed and looping routes, `W-ε`/`W`/`W+ε`, tiny routes, window edges, own-ride exclusion, ranking ties
- [ ] Adversarial superset test (including polygon-vertex midpoints) inside the documented envelope (walk at most 3 km, latitude within ±60°): zero misses
- [ ] Capped `$geoNear` recall and truncation rate reported separately
- [ ] p50/p95/p99 and docs examined in the README
- [ ] Domain coverage at least 90%
- [ ] Tag `v0.2`

---

## v0.3: Correct booking (~50 h, weeks 4-6)

**Week 4: create booking**
- [ ] Bookings and idempotency collections; unique partial `{rideId, passengerId}` index on `holdsSeat: true`; unique `{userId, key}` index
- [ ] Geometry check before the transaction
- [ ] One transaction: idempotency lookup, conditional seat claim, booking insert, idempotency insert
- [ ] `farePaise = pricePerSeatPaise × seats`, exact
- [ ] Outcome classification after an abort, replay, same-key conflict, concurrent same-key handling
- [ ] `assertInvariants` helper

**Week 5: lifecycle**
- [ ] Cancel booking (guarded update, then the ride; abort if the ride has started)
- [ ] Start ride, complete ride, cancel ride (postcondition: no held bookings and all seats free)
- [ ] State machines, booking list and get endpoints, authz tests

**Week 6: proof**
- [ ] Race matrix: last seat (50 users); same user with different keys; same key in parallel; book vs start; book vs ride cancel; double cancel; passenger cancel vs ride cancel; passenger cancel vs start; start vs ride cancel
- [ ] Model-based fast-check test
- [ ] Lost-response-after-commit test
- [ ] Booking deadline (config, default 5 s) around the whole operation; 503 `SERVICE_BUSY` with `retrySafeWithSameKey` when the outcome is uncertain
- [ ] Two separate tests:
  - Correctness: every response is 201, 409 or 503; a 503 is retried with the same key to a bounded count; afterwards there is one booking, seats are 0 and invariants hold
  - Deadline: a tiny deadline with injected delay verifies the 503 and the same-key retry
- [ ] "50 users, one 201, 49 409s, no 5xx" is a measured benchmark, not a CI gate
- [ ] Contention numbers at 50, 200 and 500 published

**Acceptance**
- [ ] Race matrix and model-based test pass (pre-tag)
- [ ] A direct out-of-range seat write is rejected by the DB validator
- [ ] Coverage at least 90% for domain and 80% for services
- [ ] Tag `v0.3`

---

## v0.4: Matcher (~30 h, weeks 7-8)

**Build**
- [ ] Ride requests (create, get, cancel, window validation) and the seeded ADMIN role
- [ ] Normalized cost: `0.5·(walks)/(2·W_r) + 0.3·|time − window midpoint|/(L_r/2) + 0.2·min(price/P_ref, 1)`, with `P_ref` configured in paise
- [ ] Solvers on identical inputs: sequential greedy, edge greedy, Hungarian, plus a brute-force oracle for n ≤ 7
- [ ] Hungarian matrix: R × (S + R), with one row per request and one column per seat slot plus one dummy "unmatched" column per request
- [ ] Integer-scaled costs, K = 1,000,000:
  - feasible edge: `round(c × K)`
  - unmatched: `M = (R + 1)·K`
  - infeasible real edge: `M + K`
- [ ] Deterministic ordering: slots by (ride ID, seat index), requests by (createdAt, ID)
- [ ] Batch flow: books each assignment through the booking service with key `match:{requestId}:{rideId}`; request OPEN → MATCHED in the same transaction; a failed assignment is skipped, the request stays OPEN, and the run summary records the reason
- [ ] Benchmarks: R from 50 to 500, balanced, scarce and abundant supply, 20 seeds each

**Acceptance**
- [ ] Matched count and total scaled cost equal brute force, across R > S, R < S, R = S, requests with no feasible slot, and all-infeasible matrices
- [ ] No infeasible edge appears in any solution
- [ ] Hungarian never matches fewer than greedy and is deterministic
- [ ] A match run concurrent with direct bookings never double-books; match vs request cancel stays consistent
- [ ] Results table in the README with limitations stated
- [ ] Tag `v0.4`

---

## v0.5: Performance (~20 h, week 9)

**Build**
- [ ] Redis in Compose; rate limiter on login, search and booking (per user and per IP) that fails open with a logged warning
- [ ] Candidate-cache experiment: quantized coordinates, time buckets, short TTL, candidate IDs only. Keep it only if p95 improves by about 20% or more at a stated hit rate; otherwise remove it and record why
- [ ] Three k6 scenarios: search-heavy, booking contention with a hot ride, mixed
- [ ] `/ready` checks Redis
- [ ] CI coverage gates: domain at least 90%, services at least 80%, overall at least 75%

**Acceptance**
- [ ] Killing Redis leaves the API up (tested)
- [ ] k6 results published with machine details; 409s separated from 5xx
- [ ] Tag `v0.5`

---

## v1.0: Polish (~20 h, week 10)

**Build**
- [ ] Refresh tokens: hashed, rotated atomically in one transaction. Reuse within a 10 s grace window returns 401 without revoking; reuse after it revokes all of that user's tokens. Access token drops to 15 minutes
- [ ] OpenAPI spec, `npm audit` in CI, ADR index
- [ ] README: pitch, Mermaid architecture diagram, what's built, roadmap, limitations, benchmark tables, claim ledger
- [ ] `docs/DEMO.md` and a 2-minute demo video
- [ ] Live HTTPS deployment with seeded data (check current free-tier limits and that your hosted Mongo supports transactions)

**Acceptance**
- [ ] Concurrent-refresh test passes
- [ ] Fresh-clone check passes
- [ ] Every README claim traces to a test or benchmark
- [ ] Tag `v1.0`

---

## After v1.0 (only if time remains)

| Tag | Work |
|---|---|
| v1.1 | Web dashboard, 4 screens, capped at about 25 h |
| v1.2 | Failure injection and a written postmortem |
| v1.3 | BullMQ expiry and approval timeouts |
| v1.4 | Simulator |
| Later | Live location, mid-route booking, segment-based seats, mobile client |

---

## Schedule

| Weeks | Work |
|---|---|
| 1 | Gate 0, start v0.1 |
| 2 | Finish v0.1 |
| 3 | v0.2 |
| 4-6 | v0.3 |
| 7-8 | v0.4 |
| 9 | v0.5 |
| 10 | v1.0 |
| 11-12 | Buffer |

- **Calibrate after week 2:** scale the remaining estimates by your actual-to-planned ratio for v0.1.
- **Cut order if time runs short:** refresh tokens, then the Redis cache experiment, then extra matching scenarios (keep balanced only), then demo video polish.
- **Never cut:** v0.3, the oracles, and the README claim discipline.
