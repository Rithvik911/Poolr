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

### Lessons learned

- MongoDB transactions only protect operations participating in the transaction.
- Explicit session propagation is necessary for Poolr's transactional repository methods.
- Mongoose 9.11.2 required `ordered: true` for the tested multi-document `create()` operation with a session.
- Tests must verify the intended failure, not merely the expected final document count.

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
## S2 — 100,000-route geospatial benchmark

- Dataset: 100,000 synthetic three-point GeoJSON LineStrings
- Generator seed: 42
- Collection: `poolr.s2benchmark100k`
- Index: `route_2dsphere`
- Query parameters: Same as the 10k baseline
- Timing method: Single MongoDB `explain("executionStats")` observation

| Query | Returned | Docs examined | Keys examined | Time |
|---|---:|---:|---:|---:|
| `$geoIntersects` polygon | 1,270 | 1,652 | 13,175 | 14 ms |
| `$geoNear` within 3,000 m | 4,390 | 72,562 | 72,922 | 143 ms |

### Comparison with 10k baseline

- Dataset size increased by 10x.
- `$geoIntersects` document examinations increased
  from 164 to 1,652 (approximately 10.07x).
- `$geoNear` document examinations increased
  from 7,164 to 72,562 (approximately 10.13x).
- The `$geoIntersects` examined-document count was
  approximately 1.65% of stored documents at both sizes.
- `$geoNear` required substantially more index and document
  examination work than `$geoIntersects` for these particular
  query shapes and parameters.

### Limitations

- Routes are synthetic three-point LineStrings, not real road routes.
- The two query operators perform different geographic searches.
- Timings come from single local execution observations.
- No warmup, repeated-trial statistics, concurrency, or p95/p99
  latency measurements were collected.
- These findings do not establish production scalability.
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

All 17 automated assertions passed, covering:

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

### Key Findings

- Turf's `location` property provides distance along a LineString from its beginning.
- A single `nearestPointOnLine()` projection may miss later visits on looping routes.
- Examining each segment separately allows multiple route positions to be considered.
- Distinct segment projections can represent the same route position and require deduplication.
- Geometric ordering and proximity checks can reject unsuitable candidates, but do not establish real-world ride feasibility.

### Limitations

- Synthetic geometries do not represent actual road routes.
- Geographic proximity does not measure driving distance or detour time.
- The 1 km proximity, 100 m journey, and 1 mm deduplication thresholds are experimental.
- Large-scale performance and road-network behavior have not been evaluated.
- Passing 17 targeted tests does not establish production correctness.

### Next

Document the architectural implications in ADR-0003 and review the S3 implementation before merging.