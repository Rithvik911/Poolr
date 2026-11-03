
import { rateLimit } from "express-rate-limit";

export function createLoginRateLimiter(limit = 10) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many login attempts. Please try again later."
    }
  });
}

export const loginRateLimiter = createLoginRateLimiter();
