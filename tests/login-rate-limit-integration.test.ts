
import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app";

describe("Login rate limiter integration", () => {
  it("limits requests on the real /auth/login route", async () => {
    // Use malformed input to avoid bcrypt and database work.
    // A 400 response still counts because the limiter runs
    // before loginController validates the request.
    for (let attempt = 0; attempt < 10; attempt++) {
      const response = await request(app)
        .post("/auth/login")
        .send({});

      expect(response.status).toBe(400);
    }

    // The production limiter allows 10 requests per IP.
    // The next request must be rejected before reaching
    // the login controller.
    const blocked = await request(app)
      .post("/auth/login")
      .send({});

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      message: "Too many login attempts. Please try again later."
    });
  });
});
