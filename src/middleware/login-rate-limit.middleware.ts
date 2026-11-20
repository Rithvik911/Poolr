import { rateLimit } from "express-rate-limit";
import { AppError } from "../errors/app-error";

export function createLoginRateLimiter(limit = 10) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(
        new AppError({
          statusCode: 429,
          code: "RATE_LIMITED",
          message: "Too many login attempts. Please try again later.",
        }),
      );
    },
  });
}

export const loginRateLimiter = createLoginRateLimiter();
