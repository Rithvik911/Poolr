import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { AppError } from "../errors/app-error";
import {
  InvalidRideSearchWindowError,
  searchRides,
} from "../services/ride-search.service";
import { toRideResponse } from "../utils/ride-response";
import { searchRidesQuerySchema } from "../validators/ride-search.validator";

export async function searchRidesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const validationResult =
    searchRidesQuerySchema.safeParse(req.query);

  if (!validationResult.success) {
    next(
      new AppError({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid ride search query",
        details: validationResult.error.flatten(),
      }),
    );
    return;
  }

  try {
    const searchResult = await searchRides(
      res.locals.userId,
      validationResult.data,
    );

    res.status(200).json({
      results: searchResult.results.map(
        ({ ride, walkPickupM }) => ({
          ...toRideResponse(ride),
          walkPickupM,
        }),
      ),
      truncated: searchResult.truncated,
    });
  } catch (error) {
    if (error instanceof InvalidRideSearchWindowError) {
      next(
        new AppError({
          statusCode: 400,
          code: "VALIDATION_ERROR",
          message: error.message,
        }),
      );
      return;
    }

    next(error);
  }
}
