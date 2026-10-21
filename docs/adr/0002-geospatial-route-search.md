# ADR-0002: Geospatial Route Search

**Status:** Proposed  
**Context:** Poolr — Gate 0, Spike S2

## Context

Poolr needs to identify rides whose stored routes are geographically relevant to a passenger's pickup or drop-off location.

A route is represented as a GeoJSON `LineString` containing coordinates in `[longitude, latitude]` order.

We evaluated MongoDB's `2dsphere` index with two geospatial operations:

- `$geoIntersects` — finds route geometries intersecting a specified geometry.
- `$geoNear` — returns documents ordered by distance from a point, with optional distance constraints.

## Decision

Use MongoDB GeoJSON `LineString` geometries with a `2dsphere` index as an initial geographic candidate-search mechanism.

Treat geospatial results as **candidates**, not confirmed ride matches.

Exact pickup/drop-off suitability, along-route ordering, detour constraints, and available seats must be evaluated separately.

This decision is provisional pending S3 route-positioning experiments and later application-level performance testing.

## Experimental evidence

We generated deterministic synthetic datasets using seed `42`, containing three-point LineStrings. We evaluated 10,000 and 100,000 routes.

| Query | Routes | Returned | Documents examined | Index keys examined | Execution time |
|---|---:|---:|---:|---:|---:|
| `$geoIntersects` | 10,000 | 125 | 164 | 1,290 | 2 ms |
| `$geoIntersects` | 100,000 | 1,270 | 1,652 | 13,175 | 14 ms |
| `$geoNear` | 10,000 | 422 | 7,164 | 7,254 | 19 ms |
| `$geoNear` | 100,000 | 4,390 | 72,562 | 72,922 | 143 ms |

The `$geoIntersects` winning query plan showed `IXSCAN` using `route_2dsphere`, followed by `FETCH`.

For these specific queries, document-examination counts grew approximately proportionally with the number of generated routes.

These operators use different geographic predicates, so the timings are not a controlled head-to-head comparison.

## Consequences

### Benefits

- MongoDB supports indexing and querying GeoJSON route geometries.
- Geographic filtering can reduce the candidate set before more expensive application-level checks.
- The same geographic query parameters can be tested against reproducible seeded datasets.

### Limitations

- Synthetic three-point LineStrings do not represent real road geometry.
- Proximity to a route does not establish whether a passenger can be picked up and dropped off in the correct travel direction.
- `$geoNear` measures geographic proximity, not driving or walking distance.
- The measurements are single local observations, not p95/p99 benchmarks.
- MongoDB document-examination counters do not necessarily represent distinct documents.
- No concurrent-load or production-scale claim is established by these experiments.

## Follow-up

- **S3:** Investigate projection onto routes and pickup-before-drop-off ordering with Turf.
- **Later:** Test real route geometries, realistic location distributions, repeated query timings, and concurrent application workloads.

## References

- `spikes/s2-geospatial.ts`
- `docs/LOG.md`
- `docs/adr/0001-transactions.md`
