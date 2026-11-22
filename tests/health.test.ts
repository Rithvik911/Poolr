import mongoose from "mongoose";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { expectApiError } from "./api-contract-assertions";

describe("GET /health", () => {
  it("returns the API health status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "Poolr API",
    });
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
  });
});

describe("GET /ready", () => {
  it("reports ready when MongoDB is connected", async () => {
    const response = await request(app).get("/ready");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ready",
      service: "Poolr API",
      checks: {
        mongo: "up",
      },
    });
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
  });

  it("returns a correlated 503 when MongoDB is unavailable", async () => {
    const readyState = vi
      .spyOn(mongoose.connection, "readyState", "get")
      .mockReturnValue(0);

    const response = await request(app).get("/ready");

    expectApiError(
      response,
      503,
      "SERVICE_BUSY",
      "Service is not ready",
    );
    expect(response.body.error.details).toEqual({
      checks: {
        mongo: "down",
      },
    });

    readyState.mockRestore();
  });
});
