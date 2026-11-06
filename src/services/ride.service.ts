import { length, lineString } from "@turf/turf";
import { RideModel } from "../models/ride.model";
import { UserModel } from "../models/user.model";
import type { CreateRideInput } from "../validators/ride.validator";
import { Types } from "mongoose";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

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
