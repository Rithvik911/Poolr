import type {
  NextFunction,
  Request,
  Response,
} from "express";
import mongoose from "mongoose";
import { AppError } from "../errors/app-error";

export function healthController(
  _req: Request,
  res: Response,
): void {
  res.status(200).json({
    status: "ok",
    service: "Poolr API",
  });
}

export function readinessController(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (mongoose.connection.readyState !== 1) {
    next(
      new AppError({
        statusCode: 503,
        code: "SERVICE_BUSY",
        message: "Service is not ready",
        details: {
          checks: {
            mongo: "down",
          },
        },
      }),
    );
    return;
  }

  res.status(200).json({
    status: "ready",
    service: "Poolr API",
    checks: {
      mongo: "up",
    },
  });
}
