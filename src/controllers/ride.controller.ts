import mongoose from "mongoose";
import type { Request, Response } from "express";
import {
  createRide,
  DriverRequiredError,
  getRideById,
  InvalidDepartureTimeError,
  InvalidRideIdError,
  RideNotFoundError,
  RouteTooShortError,
} from "../services/ride.service";
import { createRideSchema } from "../validators/ride.validator";

export async function createRideController(
  req: Request,
  res: Response,
): Promise<void> {
  const result = createRideSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid ride data",
      errors: result.error.flatten(),
    });
    return;
  }

  try {
    // requireAuth places the authenticated user ID in res.locals.
    const driverId = res.locals.userId;

    const ride = await createRide(driverId, result.data);

    const coordinates = result.data.route.coordinates;
    const origin = coordinates[0];
    const destination = coordinates[coordinates.length - 1];

    res.status(201).json({
      success: true,
      message: "Ride created successfully",
      data: {
        id: ride._id.toString(),
        driverId: ride.driverId.toString(),
        status: ride.status,
        route: ride.route,
        origin,
        destination,
        routeLengthM: ride.routeLengthM,
        departureTime: ride.departureTime.toISOString(),
        seatsTotal: ride.seatsTotal,
        seatsAvailable: ride.seatsAvailable,
        pricePerSeatPaise: ride.pricePerSeatPaise,
        currency: "INR",
        priceDisplay: `₹${(ride.pricePerSeatPaise / 100).toFixed(2)}`,
      },
    });
  } catch (error) {
    if (error instanceof DriverRequiredError) {
      res.status(403).json({
        success: false,
        message: error.message,
      });
      return;
    }

    if (
      error instanceof InvalidDepartureTimeError ||
      error instanceof RouteTooShortError ||
      error instanceof mongoose.Error.ValidationError
    ) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Ride creation failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create ride",
    });
  }
}

export async function getRideController(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const rideId = req.params.id;

    if (typeof rideId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid ride ID",
      });
      return;
    }

    const ride = await getRideById(rideId);

    // The Mongoose schema requires every ride to have a route.
    const coordinates = ride.route!.coordinates;
    const origin = coordinates[0];
    const destination = coordinates[coordinates.length - 1];

    res.status(200).json({
      success: true,
      data: {
        id: ride._id.toString(),
        driverId: ride.driverId.toString(),
        status: ride.status,
        route: ride.route,
        origin,
        destination,
        routeLengthM: ride.routeLengthM,
        departureTime: ride.departureTime.toISOString(),
        seatsTotal: ride.seatsTotal,
        seatsAvailable: ride.seatsAvailable,
        pricePerSeatPaise: ride.pricePerSeatPaise,
        currency: "INR",
        priceDisplay: `₹${(ride.pricePerSeatPaise / 100).toFixed(2)}`,
      },
    });
  } catch (error) {
    if (error instanceof InvalidRideIdError) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    if (error instanceof RideNotFoundError) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Get ride failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to fetch ride",
    });
  }
}
