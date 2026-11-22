import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { errorHandler } from "../src/middleware/error.middleware";
import { requestIdMiddleware } from "../src/middleware/request-id.middleware";
import { expectApiError } from "./api-contract-assertions";

describe("API contract", () => {
  it("preserves a valid caller-supplied request ID", async () => {
    const response = await request(app)
      .get("/health")
      .set("X-Request-Id", "client-request-123");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe("client-request-123");
  });

  it("replaces an invalid caller-supplied request ID", async () => {
    const response = await request(app)
      .get("/health")
      .set("X-Request-Id", "invalid request id");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.headers["x-request-id"]).not.toBe("invalid request id");
  });

  it("correlates unmatched-route errors in the header and body", async () => {
    const response = await request(app)
      .get("/v1/unknown")
      .set("X-Request-Id", "not-found-123");

    expectApiError(response, 404, "NOT_FOUND", "Route not found");
    expect(response.headers["x-request-id"]).toBe("not-found-123");
    expect(response.body.error.requestId).toBe("not-found-123");
  });

  it("does not retain unversioned compatibility aliases", async () => {
    const response = await request(app).post("/auth/login").send({});

    expectApiError(response, 404, "NOT_FOUND", "Route not found");
  });

  it("formats malformed JSON as a validation error", async () => {
    const response = await request(app)
      .post("/v1/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');

    expectApiError(
      response,
      400,
      "VALIDATION_ERROR",
      "Request body contains invalid JSON",
    );
  });

  it("hides unexpected error details and keeps request correlation", async () => {
    const testApp = express();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    testApp.use(requestIdMiddleware);
    testApp.get("/explode", () => {
      throw new Error("sensitive database details");
    });
    testApp.use(errorHandler);

    const response = await request(testApp).get("/explode");

    expectApiError(
      response,
      500,
      "INTERNAL",
      "An unexpected error occurred",
    );
    expect(JSON.stringify(response.body)).not.toContain(
      "sensitive database details",
    );
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Unhandled request error",
        requestId: response.headers["x-request-id"],
        error: expect.any(Error),
      }),
    );

    log.mockRestore();
  });
});
