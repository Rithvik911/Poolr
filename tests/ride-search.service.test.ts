import { destination, point } from "@turf/turf";
import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import type { RideStatus } from "../src/models/ride.model";
import { RideModel } from "../src/models/ride.model";
import {
  InvalidRideSearchWindowError,
  resolveDepartureWindow,
  searchRides,
} from "../src/services/ride-search.service";
import type { SearchRidesQuery } from "../src/validators/ride-search.validator";

const PICKUP: [number, number] = [77.5946, 12.9716];
const SEARCH_START = "2026-11-20T09:00:00.000Z";
const SEARCH_END = "2026-11-21T09:00:00.000Z";

interface RideOverrides {
  id?: Types.ObjectId;
  status?: RideStatus;
  routeCoordinates?: [number, number][];
  departureTime?: string;
  seatsTotal?: number;
  seatsAvailable?: number;
}

function routeStartingAtDistanceM(
  distanceM: number,
): [number, number][] {
  const start = destination(
    point(PICKUP),
    distanceM,
    0,
    { units: "meters" },
  ).geometry.coordinates as [number, number];
  const end = destination(
    point(PICKUP),
    distanceM + 1_000,
    0,
    { units: "meters" },
  ).geometry.coordinates as [number, number];

  return [start, end];
}

async function createSearchRide(
  driverId: Types.ObjectId,
  overrides: RideOverrides = {},
) {
  const seatsTotal = overrides.seatsTotal ?? 3;

  return RideModel.create({
    ...(overrides.id ? { _id: overrides.id } : {}),
    driverId,
    status: overrides.status ?? "SCHEDULED",
    route: {
      type: "LineString",
      coordinates:
        overrides.routeCoordinates ??
        routeStartingAtDistanceM(0),
    },
    routeLengthM: 1_000,
    departureTime: new Date(
      overrides.departureTime ??
        "2026-11-20T12:00:00.000Z",
    ),
    seatsTotal,
    seatsAvailable:
      overrides.seatsAvailable ?? seatsTotal,
    pricePerSeatPaise: 12_000,
  });
}

function validSearchInput(
  overrides: Partial<SearchRidesQuery> = {},
): SearchRidesQuery {
  return {
    pickupLng: PICKUP[0],
    pickupLat: PICKUP[1],
    maxWalkM: 1_000,
    seats: 1,
    limit: 20,
    ...overrides,
  };
}

describe("Ride search service", () => {
  const now = new Date("2026-11-20T09:00:00.000Z");

  it("defaults to a 24-hour window beginning now", () => {
    const window = resolveDepartureWindow(
      validSearchInput(),
      now,
    );

    expect(window.departAfter.toISOString()).toBe(
      "2026-11-20T09:00:00.000Z",
    );

    expect(window.departBefore.toISOString()).toBe(
      "2026-11-21T09:00:00.000Z",
    );
  });

  it("defaults departBefore to 24 hours after a supplied departAfter", () => {
    const window = resolveDepartureWindow(
      validSearchInput({
        departAfter: "2026-11-22T10:30:00.000Z",
      }),
      now,
    );

    expect(window.departAfter.toISOString()).toBe(
      "2026-11-22T10:30:00.000Z",
    );

    expect(window.departBefore.toISOString()).toBe(
      "2026-11-23T10:30:00.000Z",
    );
  });

  it("accepts a window exactly 7 days long", () => {
    const window = resolveDepartureWindow(
      validSearchInput({
        departAfter: "2026-11-20T09:00:00.000Z",
        departBefore: "2026-11-27T09:00:00.000Z",
      }),
      now,
    );

    expect(window.departBefore.toISOString()).toBe(
      "2026-11-27T09:00:00.000Z",
    );
  });

  it("rejects a reversed departure window", () => {
    expect(() =>
      resolveDepartureWindow(
        validSearchInput({
          departAfter: "2026-11-21T09:00:00.000Z",
          departBefore: "2026-11-20T09:00:00.000Z",
        }),
        now,
      ),
    ).toThrow(InvalidRideSearchWindowError);
  });

  it("rejects a window longer than 7 days", () => {
    expect(() =>
      resolveDepartureWindow(
        validSearchInput({
          departAfter: "2026-11-20T09:00:00.000Z",
          departBefore: "2026-11-27T09:00:00.001Z",
        }),
        now,
      ),
    ).toThrow(InvalidRideSearchWindowError);
  });

  it("returns a scheduled ride passing near the pickup", async () => {
    const requesterId = new Types.ObjectId();
    const ride = await createSearchRide(
      new Types.ObjectId(),
    );

    const result = await searchRides(
      requesterId.toString(),
      validSearchInput({
        departAfter: SEARCH_START,
        departBefore: SEARCH_END,
      }),
      now,
    );

    expect(result.truncated).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.ride._id.toString()).toBe(
      ride._id.toString(),
    );
    expect(result.results[0]!.walkPickupM).toBeCloseTo(
      0,
      2,
    );
  });

  it("filters by status, seats, ownership, and inclusive departure window", async () => {
    const requesterId = new Types.ObjectId();
    const otherDriverId = new Types.ObjectId();
    const atStart = await createSearchRide(
      otherDriverId,
      { departureTime: SEARCH_START },
    );
    const atEnd = await createSearchRide(
      otherDriverId,
      { departureTime: SEARCH_END },
    );

    await Promise.all([
      createSearchRide(requesterId),
      createSearchRide(otherDriverId, {
        status: "CANCELLED",
      }),
      createSearchRide(otherDriverId, {
        status: "STARTED",
      }),
      createSearchRide(otherDriverId, {
        seatsAvailable: 0,
      }),
      createSearchRide(otherDriverId, {
        departureTime: "2026-11-20T08:59:59.999Z",
      }),
      createSearchRide(otherDriverId, {
        departureTime: "2026-11-21T09:00:00.001Z",
      }),
    ]);

    const result = await searchRides(
      requesterId.toString(),
      validSearchInput({
        departAfter: SEARCH_START,
        departBefore: SEARCH_END,
      }),
      now,
    );
    const resultIds = result.results.map(({ ride }) =>
      ride._id.toString(),
    );

    expect(resultIds).toEqual([
      atStart._id.toString(),
      atEnd._id.toString(),
    ]);
  });

  it("includes W-epsilon and W, but excludes W+epsilon", async () => {
    const requesterId = new Types.ObjectId();
    const otherDriverId = new Types.ObjectId();
    const inside = await createSearchRide(
      otherDriverId,
      { routeCoordinates: routeStartingAtDistanceM(999) },
    );
    const boundary = await createSearchRide(
      otherDriverId,
      { routeCoordinates: routeStartingAtDistanceM(1_000) },
    );
    await createSearchRide(otherDriverId, {
      routeCoordinates: routeStartingAtDistanceM(1_001),
    });

    const result = await searchRides(
      requesterId.toString(),
      validSearchInput({
        departAfter: SEARCH_START,
        departBefore: SEARCH_END,
        maxWalkM: 1_000,
      }),
      now,
    );

    expect(
      result.results.map(({ ride }) =>
        ride._id.toString(),
      ),
    ).toEqual([
      inside._id.toString(),
      boundary._id.toString(),
    ]);
    expect(result.results[0]!.walkPickupM).toBeCloseTo(
      999,
      2,
    );
    expect(result.results[1]!.walkPickupM).toBeCloseTo(
      1_000,
      2,
    );
  });

  it("ranks by exact walk, departure time, and ride ID before applying limit", async () => {
    const requesterId = new Types.ObjectId();
    const otherDriverId = new Types.ObjectId();
    const tiedLowerId = new Types.ObjectId(
      "300000000000000000000001",
    );
    const tiedHigherId = new Types.ObjectId(
      "300000000000000000000002",
    );
    const close = await createSearchRide(otherDriverId, {
      routeCoordinates: routeStartingAtDistanceM(100),
      departureTime: "2026-11-20T18:00:00.000Z",
    });
    const farther = await createSearchRide(otherDriverId, {
      routeCoordinates: routeStartingAtDistanceM(200),
      departureTime: "2026-11-20T10:00:00.000Z",
    });
    const tiedEarlier = await createSearchRide(
      otherDriverId,
      {
        routeCoordinates: routeStartingAtDistanceM(300),
        departureTime: "2026-11-20T11:00:00.000Z",
      },
    );
    await createSearchRide(otherDriverId, {
      id: tiedHigherId,
      routeCoordinates: routeStartingAtDistanceM(300),
      departureTime: "2026-11-20T12:00:00.000Z",
    });
    await createSearchRide(otherDriverId, {
      id: tiedLowerId,
      routeCoordinates: routeStartingAtDistanceM(300),
      departureTime: "2026-11-20T12:00:00.000Z",
    });

    const result = await searchRides(
      requesterId.toString(),
      validSearchInput({
        departAfter: SEARCH_START,
        departBefore: SEARCH_END,
        limit: 4,
      }),
      now,
    );

    expect(
      result.results.map(({ ride }) =>
        ride._id.toString(),
      ),
    ).toEqual([
      close._id.toString(),
      farther._id.toString(),
      tiedEarlier._id.toString(),
      tiedLowerId.toString(),
    ]);
  });

  it("reports truncation when more than 500 candidates match", async () => {
    const requesterId = new Types.ObjectId();
    const otherDriverId = new Types.ObjectId();

    await RideModel.insertMany(
      Array.from({ length: 501 }, (_, index) => ({
        driverId: otherDriverId,
        status: "SCHEDULED",
        route: {
          type: "LineString",
          coordinates: routeStartingAtDistanceM(0),
        },
        routeLengthM: 1_000,
        departureTime: new Date(
          new Date(SEARCH_START).getTime() + index,
        ),
        seatsTotal: 3,
        seatsAvailable: 3,
        pricePerSeatPaise: 12_000,
      })),
    );

    const result = await searchRides(
      requesterId.toString(),
      validSearchInput({
        departAfter: SEARCH_START,
        departBefore: SEARCH_END,
        limit: 1,
      }),
      now,
    );

    expect(result.truncated).toBe(true);
    expect(result.results).toHaveLength(1);
  });
});
