import {
  circle,
  distance,
  lineString,
  nearestPointOnLine,
  point,
} from "@turf/turf";
import { Types } from "mongoose";
import type { RideDocument } from "../models/ride.model";
import { RideModel } from "../models/ride.model";
import type { SearchRidesQuery } from "../validators/ride-search.validator";

// Search-window defaults from the Poolr specification.
const ONE_DAY_MS = 24 * 60 * 60 * 1_000;
const DEFAULT_SEARCH_WINDOW_MS = ONE_DAY_MS;
const MAX_SEARCH_WINDOW_MS = 7 * ONE_DAY_MS;

// Bound the number of routes that need an exact Turf calculation.
const CANDIDATE_LIMIT = 500;
// Turf circles are polygons, so inflate the radius to protect the true boundary.
const CANDIDATE_RADIUS_INFLATION = 1.01;

export class InvalidRideSearchWindowError extends Error {
  constructor() {
    super("Departure window must be ordered and no longer than 7 days");
    this.name = "InvalidRideSearchWindowError";
  }
}

export interface DepartureWindow {
  departAfter: Date;
  departBefore: Date;
}

export interface RideSearchMatch {
  ride: RideDocument;
  walkPickupM: number;
}

export interface RideSearchResult {
  results: RideSearchMatch[];
  truncated: boolean;
}

// Turn optional timestamps into a concrete window of at most seven days.
export function resolveDepartureWindow(
  input: SearchRidesQuery,
  now = new Date(),
): DepartureWindow {
  // Search from the supplied start, or from the current time by default.
  const departAfter = input.departAfter
    ? new Date(input.departAfter)
    : now;

  // Without an explicit end, search for 24 hours after the start.
  const departBefore = input.departBefore
    ? new Date(input.departBefore)
    : new Date(
        departAfter.getTime() + DEFAULT_SEARCH_WINDOW_MS,
      );

  const windowLengthMs =
    departBefore.getTime() - departAfter.getTime();

  if (
    Number.isNaN(departAfter.getTime()) ||
    Number.isNaN(departBefore.getTime()) ||
    windowLengthMs < 0 ||
    windowLengthMs > MAX_SEARCH_WINDOW_MS
  ) {
    throw new InvalidRideSearchWindowError();
  }

  return {
    departAfter,
    departBefore,
  };
}

// Calculate the exact straight-line distance to the nearest point on the route.
function calculatePickupWalkM(
  ride: RideDocument,
  pickup: [number, number],
): number {
  const pickupPoint = point(pickup);

  // Convert Mongoose's DocumentArray into plain coordinates for Turf.
  const routeCoordinates = ride.route!.coordinates.map(
    (coordinate) => [
      Number(coordinate[0]),
      Number(coordinate[1]),
    ],
  );
  const route = lineString(routeCoordinates);

  const nearestRoutePoint = nearestPointOnLine(
    route,
    pickupPoint,
    {
      units: "meters",
    },
  );

  return distance(
    pickupPoint,
    nearestRoutePoint,
    {
      units: "meters",
    },
  );
}

// Use the ride ID as the final tie-breaker for stable result ordering.
function compareRideIds(
  left: RideDocument,
  right: RideDocument,
): number {
  const leftId = left._id.toString();
  const rightId = right._id.toString();

  if (leftId < rightId) {
    return -1;
  }

  if (leftId > rightId) {
    return 1;
  }

  return 0;
}

export async function searchRides(
  requesterId: string,
  input: SearchRidesQuery,
  now = new Date(),
): Promise<RideSearchResult> {
  const { departAfter, departBefore } =
    resolveDepartureWindow(input, now);

  // GeoJSON and Turf both require [longitude, latitude] order.
  const pickup: [number, number] = [
    input.pickupLng,
    input.pickupLat,
  ];

  // MongoDB gets an inflated candidate area; Turf verifies the exact distance.
  const pickupCandidateArea = circle(
    point(pickup),
    input.maxWalkM * CANDIDATE_RADIUS_INFLATION,
    {
      steps: 64,
      units: "meters",
    },
  );

  // Apply cheap database filters before doing geometric work in the application.
  const candidates = await RideModel.find({
    // Only rides that have not started or ended can match.
    status: "SCHEDULED",

    // The ride must have enough seats for the request.
    seatsAvailable: {
      $gte: input.seats,
    },

    // Both edges of the requested departure window are included.
    departureTime: {
      $gte: departAfter,
      $lte: departBefore,
    },

    // Do not return the requester's own ride.
    driverId: {
      $ne: new Types.ObjectId(requesterId),
    },

    // The stored route must pass through the inflated pickup area.
    route: {
      $geoIntersects: {
        $geometry: pickupCandidateArea.geometry,
      },
    },
  })
    .sort({
      departureTime: 1,
      _id: 1,
    })
    .limit(CANDIDATE_LIMIT + 1);

  // The extra candidate tells the client that the candidate set was capped.
  const truncated =
    candidates.length > CANDIDATE_LIMIT;

  // Exact-check the bounded candidates, then rank the feasible matches.
  const rankedResults = candidates
    .slice(0, CANDIDATE_LIMIT)
    .map((ride) => ({
      ride,
      preciseWalkPickupM: calculatePickupWalkM(
        ride,
        pickup,
      ),
    }))
    // Remove safe-circle false positives using the exact Turf distance.
    .filter(
      ({ preciseWalkPickupM }) =>
        preciseWalkPickupM <= input.maxWalkM,
    )
    // Rank by walk, then departure, then ride ID for deterministic ties.
    .sort((left, right) => {
      const walkOrder =
        left.preciseWalkPickupM -
        right.preciseWalkPickupM;

      if (walkOrder !== 0) {
        return walkOrder;
      }

      const departureOrder =
        left.ride.departureTime.getTime() -
        right.ride.departureTime.getTime();

      if (departureOrder !== 0) {
        return departureOrder;
      }

      return compareRideIds(
        left.ride,
        right.ride,
      );
    })
    .slice(0, input.limit)
    // Keep full precision for decisions and round only the response value.
    .map(({ ride, preciseWalkPickupM }) => ({
      ride,
      walkPickupM:
        Math.round(preciseWalkPickupM * 100) / 100,
    }));

  return {
    results: rankedResults,
    truncated,
  };
}
