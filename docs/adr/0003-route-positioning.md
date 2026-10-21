# ADR-0003: Route Positioning and Pickup–Drop-off Ordering

**Status:** Proposed

## Context

Poolr needs to determine whether a passenger's pickup and drop-off locations are geographically compatible with a driver's planned route.

MongoDB geospatial queries can identify nearby candidate routes, but proximity alone does not establish whether the driver reaches the pickup before the drop-off.

Route geometries may also contain turns, loops, overlapping segments, and repeated locations.

## Decision

Use Turf.js to project passenger locations onto the driver's GeoJSON `LineString` and evaluate their positions along the route.

Instead of relying on a single `nearestPointOnLine()` result for the entire route, evaluate individual route segments to identify multiple candidate projections.

Calculate each projection's position as:

`Distance before segment + Distance along segment`

Retain projections within an experimental geographic proximity threshold, deduplicate equivalent positions at shared segment boundaries, and evaluate candidate pickup/drop-off pairs for valid ordering.

A journey passes the experimental ordering check when at least one pickup projection occurs sufficiently before a drop-off projection.

## Experimental Evidence

Implemented a reproducible TypeScript experiment in `spikes/s3-route-positioning.ts`.

All 17 automated tests passed, covering:

- Forward and reverse travel direction
- Identical pickup/drop-off locations
- Near-zero projected journeys
- Distant passenger rejection
- Multi-turn routes
- Looping routes and repeated visits
- Overlapping segments
- Shared-boundary deduplication
- Zero-length segments and degenerate routes
- Invalid geographic coordinates

A looping-route experiment demonstrated that using only the nearest projection can incorrectly reject a potentially valid journey.

The same geographical drop-off location appeared at both 0 km and approximately 8.781 km along the route. A pickup at approximately 1.083 km could precede the later drop-off visit, even though the single nearest projection selected the earlier occurrence.

## Consequences

### Benefits

- Supports cumulative positioning along multi-segment routes.
- Preserves separate visits to locations on looping routes.
- Reduces false negatives caused by single-projection ordering.
- Filters geographically distant candidates.
- Provides explicit checks for route geometry and minimum journey length.

### Limitations

- Geographic proximity is not equivalent to road accessibility.
- Straight-line geometry does not measure actual detour distance or travel time.
- Projection calculations have numerical tolerances.
- Evaluating every segment increases computation with route complexity.
- A valid geometric ordering does not guarantee a feasible carpool journey.
- The implementation has been evaluated using targeted synthetic cases, not realistic route datasets or production workloads.

The experimental thresholds are:

- Maximum distance from route: 1 km
- Minimum along-route journey: 100 meters
- Projection deduplication tolerance: 1 millimeter

These are not finalized business requirements.

## Follow-up

- Evaluate realistic road-route geometries.
- Investigate detour feasibility and road-network constraints.
- Assess computational cost on longer routes.
- Integrate route-position checks with geographic candidate retrieval.
- Keep route-ordering decisions separate from seat availability and booking consistency.

## References

- `spikes/s3-route-positioning.ts`
- `docs/LOG.md`
- `docs/adr/0002-geospatial-route-search.md`