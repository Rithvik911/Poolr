# ADR-0002: Geospatial Route Search

**Status:** Proposed  
**Context:** Poolr — Gate 0, Spike S2

## Context

Poolr needs to identify driver routes that are geographically compatible with a passenger's requested pickup and drop-off locations.

Driver routes are stored as GeoJSON `LineString` geometries, with coordinates in `[longitude, latitude]` order.

A geographically suitable candidate must pass near both the passenger's pickup and drop-off locations.

Geographic proximity alone does not guarantee a valid journey. Route direction, pickup-before-drop-off ordering, walking constraints, detour feasibility, and available seats require separate checks.

The experiment investigated MongoDB's `2dsphere` index and two geospatial operators:

- `$geoIntersects` — identifies geometries intersecting specified geographic regions.
- `$geoNear` — returns geometries ordered by geographic distance from a point.

## Decision

Use MongoDB's `2dsphere` index on the stored GeoJSON `LineString` route field for initial candidate discovery.

The proposed candidate-search stage uses two `$geoIntersects` predicates combined with `$and`:

1. The route must intersect a geographic circle around the passenger's pickup location.
2. The route must intersect a geographic circle around the passenger's drop-off location.

The circles are represented as Polygon geometries using Turf.js `circle()`, with a 64-step approximation and an experimental radius of 1.01 km, including 1% inflation over the nominal 1 km threshold.

This produces a geographic candidate set for subsequent application-level route-positioning and suitability checks.

Do not use the tested broad `$geoNear` query as the primary candidate-discovery approach without additional justification. Its observed document examination was substantially higher relative to the returned results in this synthetic workload.

This decision does not reject `$geoNear` for every possible use case. The operator remains useful for geographic distance calculations and distance-ordered queries.

## Experimental Environment

The experiments used:

- MongoDB server version: `7.0.45`
- Replica set: `rs0`
- MongoDB role: writable primary
- Database: `poolr`
- Collections: `s2benchmark` and `s2benchmark100k`
- Index: `route_2dsphere`
- Synthetic dataset seed: `42`
- Dataset sizes: 10,000 and 100,000 routes

The benchmark routes were generated as three-point GeoJSON LineStrings.

Server identity was verified through the S2 script and a separate MongoDB shell connection.

The measurements represent exploratory local executions, not statistically rigorous latency benchmarks.

## Experimental Evidence

### 1. Single-polygon `$geoIntersects`

The original experiment used a rectangular geographic polygon.

| Metric | 10k routes | 100k routes |
|---|---:|---:|
| Returned | 125 | 1,270 |
| Documents examined | 164 | 1,652 |
| Index keys examined | 1,290 | 13,175 |
| Documents examined / returned | 1.31× | 1.30× |

For the tested polygon query, documents examined remained approximately 1.3 times the number of returned routes.

The examination count increased with dataset size partly because the query returned proportionally more routes from the denser dataset.

This is evidence of selective filtering for this query shape, not proof of constant-time geographic search.

### 2. Broad `$geoNear` query

The original `$geoNear` experiment queried routes within a geographic distance constraint.

| Metric | 10k routes | 100k routes |
|---|---:|---:|
| Returned | 422 | 4,390 |
| Documents examined | 7,164 | 72,562 |
| Index keys examined | 7,254 | 72,922 |
| Documents examined / returned | 16.98× | 16.53× |
| Documents examined / collection size | 71.64% | 72.56% |

The tested `$geoNear` query examined a large proportion of the stored routes.

Although MongoDB used a geographic index, the observed workload involved substantially more document examination than the tested `$geoIntersects` queries.

These results do not establish that `$geoNear` is universally inefficient. Its predicate and result set differ from those of `$geoIntersects`.

### 3. Pickup-and-drop-off two-circle query

An additional experiment evaluated the proposed candidate-search stage using two `$geoIntersects` conditions combined with `$and`.

The experiment used an existing seeded route's endpoints to obtain a nonempty candidate query.

The same query coordinates were used on both datasets:

- Pickup: `[80.175704, 12.926438]`
- Drop-off: `[80.173821, 12.896366]`
- Circle radius: 1.01 km
- Circle approximation: 64 steps

| Metric | 10k routes | 100k routes |
|---|---:|---:|
| Returned | 2 | 27 |
| Documents examined | 52 | 485 |
| Index keys examined | 351 | 3,472 |
| Documents examined / returned | 26.00× | 17.96× |
| Documents examined / collection size | 0.52% | 0.485% |

The 100k experiment examined 485 documents from a collection containing 100,000 routes.

This indicates selective index-assisted candidate retrieval for the tested synthetic dataset and query coordinates.

However, the examined-to-returned ratio was higher than that of the original single-polygon query.

Both observations matter: the query accessed a small fraction of the collection but performed additional candidate examination relative to its final result count.

### 4. Winning execution plan

The 100k two-circle query was inspected using MongoDB's `explain("executionStats")`.

The winning plan contained:

`FETCH → IXSCAN`

The `IXSCAN` stage used the index:

`route_2dsphere`

The `FETCH` stage evaluated the two geographic intersection predicates.

This confirms that the tested query used the intended `2dsphere` index.

The MongoDB shell inspection independently reconstructed the circular polygons using a geographic calculation. It produced the same result counts and examination statistics as the Turf-based script.

The plan does not demonstrate two separate index scans joined together. The observed plan used a single `IXSCAN` beneath `FETCH`.

### 5. `$geoNear` distance semantics

A controlled experiment inserted three synthetic LineString routes.

A passenger point was placed near the midpoint of one route, approximately 111 meters north of its line.

The `$geoNear` results were:

| Route | Reported geographic distance |
|---|---:|
| Near-middle | 111.30 m |
| Far-north | 5,454.64 m |
| Far-south | 5,677.24 m |

The near-middle distance was much smaller than the distance to either endpoint of that LineString.

This provides direct evidence that, for the tested MongoDB configuration and geometry, `$geoNear` measured proximity to the line itself rather than restricting distance calculations to the stored vertices.

The temporary experiment collection was deleted after testing.

## Consequences

### Benefits

- MongoDB supports indexed candidate retrieval against stored driver-route geometries.
- A two-circle query can enforce geographic relevance to both pickup and drop-off areas.
- The tested candidate query examined a small fraction of the synthetic 100k collection.
- The database candidate stage can reduce the number of routes requiring more expensive application-level geometric checks.
- Execution statistics and index plans can be collected for subsequent performance evaluation.

### Limitations

- The datasets contain synthetic three-point routes, not realistic road-network paths.
- Short synthetic routes may produce more favorable index selectivity than longer and more complex routes.
- Geographic proximity does not establish actual walking accessibility or driving detour feasibility.
- The two-circle query does not verify pickup-before-drop-off ordering.
- The 1 km geographic threshold and 1% inflation remain experimental.
- The 64-step circles approximate geographic regions rather than representing exact circles.
- The experiments used a small number of query locations.
- The reported timings are single-run observations without warmup, repeated trials, or latency percentiles.
- The results do not establish production performance or scalability under concurrent load.

## Follow-up

- Evaluate realistic routes containing approximately 5–50 coordinates and longer travel distances.
- Test multiple pickup/drop-off distributions, including dense and sparse regions.
- Evaluate longer routes and the impact of route geometry on index selectivity.
- Benchmark repeated queries with warmup and controlled execution conditions.
- Combine geographic candidate retrieval with Turf.js route-positioning checks.
- Measure application-level filtering performance in v0.2.
- Revisit candidate-search strategy if realistic workloads show excessive document examination.

## References

- `spikes/s2-geospatial.ts`
- `docs/LOG.md`
- `docs/adr/0001-transactions.md`
- `docs/adr/0003-route-positioning.md`