import mongoose from "mongoose";
import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { AppError } from "../errors/app-error";
import {
  createRide,
  DriverRequiredError,
  getRideById,
  InvalidDepartureTimeError,
  InvalidRideCursorError,
  InvalidRideIdError,
  listOwnRides,
  RideNotFoundError,
  RouteTooShortError,
} from "../services/ride.service";
import { toRideResponse } from "../utils/ride-response";
import {
  createRideSchema,
  listOwnRidesQuerySchema,
} from "../validators/ride.validator";

function createValidationError(
  message: string,
  details?: unknown,
): AppError {
  return new AppError({
    statusCode: 400,
    code: "VALIDATION_ERROR",
    message,
    details,
  });
}

export async function createRideController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const result = createRideSchema.safeParse(req.body);

  if (!result.success) {
    next(
      createValidationError(
        "Invalid ride data",
        result.error.flatten(),
      ),
    );
    return;
  }

  try {
    const ride = await createRide(
      res.locals.userId,
      result.data,
    );

    res.status(201).json({
      success: true,
      message: "Ride created successfully",
      data: toRideResponse(ride),
    });
  } catch (error) {
    if (error instanceof DriverRequiredError) {
      next(
        new AppError({
          statusCode: 403,
          code: "FORBIDDEN",
          message: error.message,
        }),
      );
      return;
    }

    if (
      error instanceof InvalidDepartureTimeError ||
      error instanceof RouteTooShortError
    ) {
      next(createValidationError(error.message));
      return;
    }

    if (error instanceof mongoose.Error.ValidationError) {
      next(createValidationError("Invalid ride data"));
      return;
    }

    next(error);
  }
}

export async function getRideController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const rideId = req.params.id;

  if (typeof rideId !== "string") {
    next(createValidationError("Invalid ride ID"));
    return;
  }

  try {
    const ride = await getRideById(rideId);

    res.status(200).json({
      success: true,
      data: toRideResponse(ride),
    });
  } catch (error) {
    if (error instanceof InvalidRideIdError) {
      next(createValidationError(error.message));
      return;
    }

    if (error instanceof RideNotFoundError) {
      next(
        new AppError({
          statusCode: 404,
          code: "NOT_FOUND",
          message: error.message,
        }),
      );
      return;
    }

    next(error);
  }
}

export async function listOwnRidesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const result = listOwnRidesQuerySchema.safeParse(req.query);

  if (!result.success) {
    next(
      createValidationError(
        "Invalid ride listing query",
        result.error.flatten(),
      ),
    );
    return;
  }

  try {
    const page = await listOwnRides(
      res.locals.userId,
      result.data,
    );

    res.status(200).json({
      success: true,
      data: page.rides.map(toRideResponse),
      pagination: {
        limit: result.data.limit,
        hasMore: page.nextCursor !== null,
        nextCursor: page.nextCursor,
      },
    });
  } catch (error) {
    if (error instanceof InvalidRideCursorError) {
      next(createValidationError(error.message));
      return;
    }

    next(error);
  }
}