import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { AppError } from "../errors/app-error";

function isMalformedJsonError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400 &&
    "body" in error
  );
}

export function notFoundMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(
    new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Route not found",
      details: {
        method: req.method,
        path: req.originalUrl,
      },
    }),
  );
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = res.locals.requestId as string;

  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else if (isMalformedJsonError(error)) {
    appError = new AppError({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Request body contains invalid JSON",
    });
  } else {
    console.error({
      message: "Unhandled request error",
      requestId,
      error,
    });

    appError = new AppError({
      statusCode: 500,
      code: "INTERNAL",
      message: "An unexpected error occurred",
    });
  }

  res.status(appError.statusCode).json({
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details ?? {},
      requestId,
    },
  });
}
