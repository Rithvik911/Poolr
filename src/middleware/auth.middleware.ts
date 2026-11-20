import type {
  NextFunction,
  Request,
  Response,
} from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../errors/app-error";

function createUnauthenticatedError(message: string): AppError {
  return new AppError({
    statusCode: 401,
    code: "UNAUTHENTICATED",
    message,
  });
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authorization = req.headers.authorization;

  if (!authorization) {
    next(
      createUnauthenticatedError(
        "Authorization header is required",
      ),
    );
    return;
  }

  const [scheme, token, extra] = authorization.split(" ");

  if (scheme !== "Bearer" || !token || extra) {
    next(
      createUnauthenticatedError(
        "Authorization header must use the Bearer scheme",
      ),
    );
    return;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    next(
      new Error(
        "JWT_SECRET is missing or shorter than 32 characters",
      ),
    );
    return;
  }

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    });

    if (
      typeof payload === "string" ||
      typeof payload.userId !== "string"
    ) {
      next(
        createUnauthenticatedError(
          "Access token is invalid or expired",
        ),
      );
      return;
    }

    res.locals.userId = payload.userId;
    next();
  } catch {
    next(
      createUnauthenticatedError(
        "Access token is invalid or expired",
      ),
    );
  }
}