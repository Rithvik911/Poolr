import { length, lineString } from "@turf/turf";
import { Types } from "mongoose";
import { z } from "zod";
import { RideModel } from "../models/ride.model";
import type { RideDocument } from "../models/ride.model";
import { UserModel } from "../models/user.model";
import type { CreateRideInput } from "../validators/ride.validator";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

const rideCursorPayloadSchema = z
  .object({
    departureTime: z.iso.datetime({ offset: true }),
    id: z.string().regex(/^[0-9a-f]{24}$/),
  })
  .strict();

export class DriverRequiredError extends Error {
  constructor() {
    super("Driver capability is required to create a ride");
    this.name = "DriverRequiredError";
  }
}

export class InvalidDepartureTimeError extends Error {
  constructor() {
    super("Departure must be between 5 minutes and 90 days from now");
    this.name = "InvalidDepartureTimeError";
  }
}

export class RouteTooShortError extends Error {
  constructor() {
    super("Route must be at least 500 metres long");
    this.name = "RouteTooShortError";
  }
}
export class InvalidRideIdError extends Error {
  constructor() {
    super("Invalid ride ID");
    this.name = "InvalidRideIdError";
  }
}

export class RideNotFoundError extends Error {
  constructor() {
    super("Ride not found");
    this.name = "RideNotFoundError";
  }
}

export class InvalidRideCursorError extends Error {
  constructor() {
    super("Invalid ride cursor");
    this.name = "InvalidRideCursorError";
  }
}

interface RideCursor {
  departureTime: Date;
  id: Types.ObjectId;
}

interface RideListFilter {
  driverId: Types.ObjectId;
  $or?: Array<
    | { departureTime: { $lt: Date } }
    | { departureTime: Date; _id: { $lt: Types.ObjectId } }
  >;
}

export interface ListOwnRidesOptions {
  limit: number;
  cursor?: string;
}

export interface ListOwnRidesResult {
  rides: RideDocument[];
  nextCursor: string | null;
}

function decodeRideCursor(cursor: string): RideCursor {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) {
      throw new InvalidRideCursorError();
    }

    const decoded = Buffer.from(cursor, "base64url");

    if (decoded.toString("base64url") !== cursor) {
      throw new InvalidRideCursorError();
    }

    const payload = rideCursorPayloadSchema.parse(
      JSON.parse(decoded.toString("utf8")),
    );
    const departureTime = new Date(payload.departureTime);

    if (payload.departureTime !== departureTime.toISOString()) {
      throw new InvalidRideCursorError();
    }

    return {
      departureTime,
      id: new Types.ObjectId(payload.id),
    };
  } catch (error) {
    if (error instanceof InvalidRideCursorError) {
      throw error;
    }

    throw new InvalidRideCursorError();
  }
}

function encodeRideCursor(ride: RideDocument): string {
  return Buffer.from(
    JSON.stringify({
      departureTime: ride.departureTime.toISOString(),
      id: ride._id.toString(),
    }),
    "utf8",
  ).toString("base64url");
}

export async function getRideById(rideId: string) {
  if (!Types.ObjectId.isValid(rideId)) {
    throw new InvalidRideIdError();
  }

  const ride = await RideModel.findById(rideId);

  if (!ride) {
    throw new RideNotFoundError();
  }

  return ride;
}

export async function listOwnRides(
  driverId: string,
  options: ListOwnRidesOptions,
): Promise<ListOwnRidesResult> {
  const filter: RideListFilter = {
    driverId: new Types.ObjectId(driverId),
  };

  if (options.cursor) {
    const cursor = decodeRideCursor(options.cursor);

    filter.$or = [
      { departureTime: { $lt: cursor.departureTime } },
      {
        departureTime: cursor.departureTime,
        _id: { $lt: cursor.id },
      },
    ];
  }

  const rides = await RideModel.find(filter)
    .sort({ departureTime: -1, _id: -1 })
    .limit(options.limit + 1);
  const hasMore = rides.length > options.limit;
  const page = hasMore ? rides.slice(0, options.limit) : rides;

  return {
    rides: page,
    nextCursor: hasMore ? encodeRideCursor(page[page.length - 1]!) : null,
  };
}

export async function createRide(
  driverId: string,
  input: CreateRideInput,
  now = new Date(),
) {
  const driver = await UserModel.findById(driverId).select("isDriver");

  if (!driver?.isDriver) {
    throw new DriverRequiredError();
  }

  const departureTime = new Date(input.departureTime);
  const earliestDeparture = new Date(now.getTime() + FIVE_MINUTES_MS);
  const latestDeparture = new Date(now.getTime() + NINETY_DAYS_MS);

  if (departureTime < earliestDeparture || departureTime > latestDeparture) {
    throw new InvalidDepartureTimeError();
  }

  const route = lineString(input.route.coordinates);

  // Turf returns metres because the unit is explicitly selected.
  const preciseRouteLengthM = length(route, { units: "meters" });

  if (preciseRouteLengthM < 500) {
    throw new RouteTooShortError();
  }

  return RideModel.create({
    driverId,
    route: input.route,
    routeLengthM: Math.round(preciseRouteLengthM),
    departureTime,
    seatsTotal: input.seatsTotal,
    seatsAvailable: input.seatsTotal,
    pricePerSeatPaise: input.pricePerSeatPaise,
  });
}
