
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createLoginRateLimiter } from "../src/middleware/login-rate-limit.middleware.js";

// Give each test its own limiter instance so request counts
// cannot leak between tests and produce order-dependent failures.
function createTestApp(limit: number) {
  const app = express();

  app.post(
    "/auth/login",
    createLoginRateLimiter(limit),
    (_req, res) => {
      // Avoid real authentication and bcrypt work: these tests
      // should measure middleware behavior, not login correctness.
      res.status(200).json({
        success: true,
        message: "Request allowed"
      });
    }
  );

  return app;
}

describe("Login rate limiting", () => {
  it("allows requests within the configured limit", async () => {
    const app = createTestApp(2);

    const first = await request(app).post("/auth/login");
    const second = await request(app).post("/auth/login");

    // The request that reaches the limit is still allowed.
    // Blocking starts only after the limit has been exceeded.
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it("returns 429 after the request limit is exceeded", async () => {
    const app = createTestApp(2);

    await request(app).post("/auth/login");
    await request(app).post("/auth/login");

    // A third request from the same client exceeds the
    // two-request allowance within the configured time window.
    const blocked = await request(app).post("/auth/login");

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      message: "Too many login attempts. Please try again later."
    });
  });

  it("includes standard rate-limit response headers", async () => {
    const app = createTestApp(1);

    const response = await request(app).post("/auth/login");

    // Standard headers help clients understand their rate-limit
    // allowance instead of discovering it only through HTTP 429.
    expect(response.status).toBe(200);
    expect(response.headers["ratelimit"]).toBeDefined();
  });
});
