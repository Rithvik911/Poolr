import type { Request, Response } from "express";
import {
  InvalidRideSearchWindowError,
  searchRides,
} from "../services/ride-search.service";
import { toRideResponse } from "../utils/ride-response";
import { searchRidesQuerySchema } from "../validators/ride-search.validator";

export async function searchRidesController(
  req: Request,
  res: Response,
): Promise<void> {
  const validationResult =
    searchRidesQuerySchema.safeParse(req.query);

  if (!validationResult.success) {
    res.status(400).json({
      success: false,
      message: "Invalid ride search query",
      errors: validationResult.error.flatten(),
    });
    return;
  }

  try {
    const searchResult = await searchRides(
      res.locals.userId,
      validationResult.data,
    );

    res.status(200).json({
      success: true,
      data: {
        results: searchResult.results.map(
          ({ ride, walkPickupM }) => ({
            ...toRideResponse(ride),
            walkPickupM,
          }),
        ),
        truncated: searchResult.truncated,
      },
    });
  } catch (error) {
    if (error instanceof InvalidRideSearchWindowError) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Ride search failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to search rides",
    });
  }
}