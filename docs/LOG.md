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
- Passing 17 targeted tests does not establish production correctness.

### Next

Document the architectural implications in ADR-0003 and review the S3 implementation before merging.
