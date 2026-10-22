
import assert from "node:assert/strict";
import {
  lineString,
  point,
  nearestPointOnLine,
  length,
  destination,
} from "@turf/turf";

// ==================================================
// 1. Types and experimental configuration
// ==================================================

type Coordinate = [number, number];

type RouteProjection = {
  segmentIndex: number;
  locationKm: number;
  distanceFromRouteKm: number;
};

const MAX_DISTANCE_KM = 1;
const MIN_JOURNEY_DISTANCE_KM = 0.1;
const POSITION_EPSILON_KM = 0.000001;

// Experimental values, not production business rules.

// ==================================================
// 2. Input validation
// ==================================================

function validateCoordinate(
  coordinate: Coordinate
): void {
  const [longitude, latitude] = coordinate;

  assert.ok(
    Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180,
    "Invalid longitude"
  );

  assert.ok(
    Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90,
    "Invalid latitude"
  );
}

function validateRoute(
  coordinates: Coordinate[]
): void {
  assert.ok(
    coordinates.length >= 2,
    "A route must have at least two coordinates"
  );

  for (const coordinate of coordinates) {
    validateCoordinate(coordinate);
  }
}

// ==================================================
// 3. Find every nearby projection along a route
// ==================================================

function findRouteProjections(
  coordinates: Coordinate[],
  location: Coordinate
): RouteProjection[] {
  validateRoute(coordinates);
  validateCoordinate(location);

  const passenger = point(location);

  const projections: RouteProjection[] = [];
  let distanceBeforeSegmentKm = 0;
  let validSegmentCount = 0;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const start = coordinates[i];
    const end = coordinates[i + 1];

    // Skip zero-length segments.
    if (
      start[0] === end[0] &&
      start[1] === end[1]
    ) {
      continue;
    }

    validSegmentCount++;

    const segment = lineString([start, end]);

    const projected = nearestPointOnLine(
      segment,
      passenger,
      { units: "kilometers" }
    );

    const segmentLengthKm = length(segment, {
      units: "kilometers",
    });

    // Turf.js 7.4 current property names.
    const routePositionKm =
      distanceBeforeSegmentKm +
      projected.properties.totalDistance;

    const distanceFromRouteKm =
      projected.properties.pointDistance;

    if (distanceFromRouteKm <= MAX_DISTANCE_KM) {
      projections.push({
        segmentIndex: i,
        locationKm: routePositionKm,
        distanceFromRouteKm,
      });
    }

    distanceBeforeSegmentKm += segmentLengthKm;
  }

  assert.ok(
    validSegmentCount > 0,
    "Route must contain at least one nonzero segment"
  );

  // Sort by position along the route.
  projections.sort(
    (a, b) => a.locationKm - b.locationKm
  );

  // Remove duplicate positions at shared boundaries,
  // without removing visits that occur later on loops.
  const uniqueProjections: RouteProjection[] = [];

  for (const projection of projections) {
    const existing = uniqueProjections.at(-1);

    if (
      !existing ||
      Math.abs(
        existing.locationKm - projection.locationKm
      ) > POSITION_EPSILON_KM
    ) {
      uniqueProjections.push(projection);
    }
  }

  return uniqueProjections;
}

// ==================================================
// 4. Pickup-before-drop-off matching
// ==================================================

function hasValidPickupDropoffOrder(
  coordinates: Coordinate[],
  pickup: Coordinate,
  dropoff: Coordinate
): boolean {
  validateRoute(coordinates);
  validateCoordinate(pickup);
  validateCoordinate(dropoff);

  // Identical geographical endpoints are invalid.
  if (
    pickup[0] === dropoff[0] &&
    pickup[1] === dropoff[1]
  ) {
    return false;
  }

  const pickupPositions = findRouteProjections(
    coordinates,
    pickup
  );

  const dropoffPositions = findRouteProjections(
    coordinates,
    dropoff
  );

  // At least one feasible pickup/drop-off pair
  // must satisfy the minimum along-route distance.
  return pickupPositions.some((pickupPosition) =>
    dropoffPositions.some(
      (dropoffPosition) =>
        dropoffPosition.locationKm -
          pickupPosition.locationKm >=
        MIN_JOURNEY_DISTANCE_KM
    )
  );
}

// ==================================================
// 5. Reusable routes
// ==================================================

const straightRoute: Coordinate[] = [
  [80.20, 13.00],
  [80.22, 13.00],
  [80.24, 13.00],
];

const overlappingRoute: Coordinate[] = [
  [80.20, 13.00],
  [80.24, 13.00],
  [80.20, 13.00],
];

const loopingRoute: Coordinate[] = [
  [80.20, 13.00],
  [80.22, 13.00],
  [80.22, 13.02],
  [80.20, 13.02],
  [80.20, 13.00],
  [80.18, 13.00],
];

const multiTurnRoute: Coordinate[] = [
  [80.20, 13.00],
  [80.22, 13.00],
  [80.22, 13.02],
  [80.24, 13.02],
];

// ==================================================
// 6. Minimal test runner
// ==================================================

let passedTests = 0;

function test(
  name: string,
  run: () => void
): void {
  run();
  passedTests++;
  console.log(`PASS ${passedTests}: ${name}`);
}

// ==================================================
// TEST 1 — Overlapping segments
// ==================================================

test("Overlapping segments retain both visits", () => {
  const projections = findRouteProjections(
    overlappingRoute,
    [80.22, 13.00]
  );

  assert.equal(projections.length, 2);

  assert.ok(
    projections[0].locationKm <
      projections[1].locationKm
  );
});

// ==================================================
// TEST 2 — Distant passenger
// ==================================================

test("Distant passenger has no projections", () => {
  const projections = findRouteProjections(
    overlappingRoute,
    [80.22, 13.50]
  );

  assert.equal(projections.length, 0);
});

// ==================================================
// TEST 3 — Forward journey
// ==================================================

test("Forward journey is accepted", () => {
  assert.equal(
    hasValidPickupDropoffOrder(
      straightRoute,
      [80.21, 13.005],
      [80.23, 13.005]
    ),
    true
  );
});

// ==================================================
// TEST 4 — Reverse journey
// ==================================================

test("Reverse journey is rejected", () => {
  assert.equal(
    hasValidPickupDropoffOrder(
      straightRoute,
      [80.23, 13.005],
      [80.21, 13.005]
    ),
    false
  );
});

// ==================================================
// TEST 5 — Identical endpoints
// ==================================================

test("Identical endpoints are rejected", () => {
  assert.equal(
    hasValidPickupDropoffOrder(
      straightRoute,
      [80.22, 13.005],
      [80.22, 13.005]
    ),
    false
  );
});

// ==================================================
// TEST 6 — Looping route
// ==================================================

test("Looping route allows later drop-off", () => {
  assert.equal(
    hasValidPickupDropoffOrder(
      loopingRoute,
      [80.21, 13.00],
      [80.20, 13.00]
    ),
    true
  );
});

// ==================================================
// TEST 7 — Later route visit regression
// ==================================================

// Regression: considering only the first projection
// can reject a journey that has another valid pair.
test("Later route visit prevents a false negative", () => {
  const pickup: Coordinate = [80.21, 13.00];
  const dropoff: Coordinate = [80.20, 13.00];

  const pickupPositions = findRouteProjections(
    loopingRoute,
    pickup
  );

  const dropoffPositions = findRouteProjections(
    loopingRoute,
    dropoff
  );

  assert.ok(pickupPositions.length >= 1);
  assert.ok(dropoffPositions.length >= 2);

  // The first drop-off visit occurs before pickup.
  assert.ok(
    dropoffPositions[0].locationKm <
      pickupPositions[0].locationKm
  );

  // A later drop-off visit must satisfy the journey
  // distance requirement.
  assert.ok(
    dropoffPositions.some(
      (position) =>
        position.locationKm -
          pickupPositions[0].locationKm >=
        MIN_JOURNEY_DISTANCE_KM
    ),
    "A later drop-off visit must form a valid journey"
  );

  // The matching algorithm must accept the journey.
  assert.equal(
    hasValidPickupDropoffOrder(
      loopingRoute,
      pickup,
      dropoff
    ),
    true
  );
});

// ==================================================
// TEST 8 — Same projected position
// ==================================================

test("Nearly identical positions are rejected", () => {
  assert.equal(
    hasValidPickupDropoffOrder(
      straightRoute,
      [80.22, 13.005],
      [80.22, 12.995]
    ),
    false
  );
});

// ==================================================
// TEST 9 — Shared segment boundary
// ==================================================

test("Shared vertex is deduplicated", () => {
  const projections = findRouteProjections(
    straightRoute,
    [80.22, 13.00]
  );

  assert.equal(projections.length, 1);

  assert.equal(
    projections[0].segmentIndex,
    0
  );
});

// ==================================================
// TEST 10 — Zero-length segment
// ==================================================

test("Zero-length segment is safely skipped", () => {
  const route: Coordinate[] = [
    [80.20, 13.00],
    [80.22, 13.00],
    [80.22, 13.00],
    [80.24, 13.00],
  ];

  const projections = findRouteProjections(
    route,
    [80.22, 13.00]
  );

  assert.equal(projections.length, 1);

  assert.ok(
    Number.isFinite(projections[0].locationKm)
  );
});

// ==================================================
// TEST 11 — Completely degenerate route
// ==================================================

test("Route with only zero-length segments is rejected", () => {
  const route: Coordinate[] = [
    [80.20, 13.00],
    [80.20, 13.00],
  ];

  assert.throws(
    () =>
      findRouteProjections(
        route,
        [80.20, 13.00]
      ),
    /nonzero segment/
  );
});

// ==================================================
// TEST 12 — Too few route coordinates
// ==================================================

test("Single-point route is rejected", () => {
  const route: Coordinate[] = [
    [80.20, 13.00],
  ];

  assert.throws(
    () =>
      findRouteProjections(
        route,
        [80.20, 13.00]
      ),
    /at least two coordinates/
  );
});

// ==================================================
// TEST 13 — Invalid longitude
// ==================================================

test("Invalid longitude is rejected", () => {
  const route: Coordinate[] = [
    [200, 13.00],
    [80.22, 13.00],
  ];

  assert.throws(
    () =>
      findRouteProjections(
        route,
        [80.21, 13.00]
      ),
    /Invalid longitude/
  );
});

// ==================================================
// TEST 14 — Invalid latitude
// ==================================================

test("Invalid latitude is rejected", () => {
  const route: Coordinate[] = [
    [80.20, 95],
    [80.22, 13.00],
  ];

  assert.throws(
    () =>
      findRouteProjections(
        route,
        [80.21, 13.00]
      ),
    /Invalid latitude/
  );
});

// ==================================================
// TEST 15 — NaN coordinates
// ==================================================

test("Non-finite coordinates are rejected", () => {
  assert.throws(
    () =>
      findRouteProjections(
        straightRoute,
        [NaN, 13.00]
      ),
    /Invalid longitude/
  );
});

// ==================================================
// TEST 16 — Short journey under 100 m
// ==================================================

test("Journey shorter than 100 m is rejected", () => {
  const eligible = hasValidPickupDropoffOrder(
    straightRoute,
    [80.2100, 13.00],
    [80.2105, 13.00]
  );

  assert.equal(eligible, false);
});

// ==================================================
// TEST 17 — Journey over 100 m
// ==================================================

test("Journey longer than 100 m is accepted", () => {
  const eligible = hasValidPickupDropoffOrder(
    straightRoute,
    [80.210, 13.00],
    [80.212, 13.00]
  );

  assert.equal(eligible, true);
});

// ==================================================
// TEST 18 — Multi-turn route
// ==================================================

test("Ordering works across multiple turns", () => {
  const pickup: Coordinate = [80.21, 13.00];
  const dropoff: Coordinate = [80.23, 13.02];

  const pickupProjections = findRouteProjections(
    multiTurnRoute,
    pickup
  );

  const dropoffProjections = findRouteProjections(
    multiTurnRoute,
    dropoff
  );

  assert.ok(pickupProjections.length > 0);
  assert.ok(dropoffProjections.length > 0);

  assert.equal(
    hasValidPickupDropoffOrder(
      multiTurnRoute,
      pickup,
      dropoff
    ),
    true
  );
});

// ==================================================
// TESTS 19–20 — Proximity threshold regression
// ==================================================

test("Passenger just inside 1 km is accepted", () => {
  const passenger = destination(
    point([80.21, 13.00]),
    0.99,
    0,
    { units: "kilometers" }
  ).geometry.coordinates as Coordinate;

  const projections = findRouteProjections(
    straightRoute,
    passenger
  );

  assert.ok(
    projections.length > 0,
    "A passenger 0.99 km from the route should have a projection"
  );
});

test("Passenger just outside 1 km is rejected", () => {
  const passenger = destination(
    point([80.21, 13.00]),
    1.01,
    0,
    { units: "kilometers" }
  ).geometry.coordinates as Coordinate;

  const projections = findRouteProjections(
    straightRoute,
    passenger
  );

  assert.equal(
    projections.length,
    0,
    "A passenger 1.01 km from the route should have no projections"
  );
});

// ==================================================
// 7. Summary
// ==================================================

console.log(
  `\nAll ${passedTests} S3 tests passed.`
);
