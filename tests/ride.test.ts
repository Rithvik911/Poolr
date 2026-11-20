import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app";
import { RideModel } from "../src/models/ride.model";
import { UserModel } from "../src/models/user.model";
import { generateAccessToken } from "../src/utils/jwt";
import { expectApiError } from "./api-contract-assertions";

function validRideBody() {
  return {
    route: {
      type: "LineString",
      coordinates: [
        [77.5946, 12.9716],
        [77.6046, 12.9716],
      ],
    },
    departureTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    seatsTotal: 3,
    pricePerSeatPaise: 12_000,
  };
}

async function registerAndLogin(
  email: string,
  isDriver: boolean,
): Promise<string> {
  const password = "TestPass123!";

  await request(app)
    .post("/v1/auth/register")
    .send({
      name: "Ride Test User",
      email,
      password,
      isDriver,
    })
    .expect(201);

  const loginResponse = await request(app)
    .post("/v1/auth/login")
    .send({
      email,
      password,
    })
    .expect(200);

  return loginResponse.body.accessToken;
}

async function createTestAccessToken(
  email: string,
  isDriver: boolean,
): Promise<string> {
  const user = await UserModel.create({
    name: "Ride Test User",
    email,
    passwordHash: "unused-in-ride-tests",
    isDriver,
  });

  return generateAccessToken(user._id.toString());
}

describe("Ride integration", () => {
  it("creates a ride for an authenticated driver", async () => {
    const accessToken = await registerAndLogin("ride.driver@example.com", true);

    const response = await request(app)
      .post("/v1/rides")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validRideBody());

    expect(response.status).toBe(201);

    expect(response.body).toMatchObject({
      success: true,
      message: "Ride created successfully",
      data: {
        status: "SCHEDULED",
        origin: [77.5946, 12.9716],
        destination: [77.6046, 12.9716],
        seatsTotal: 3,
        seatsAvailable: 3,
        pricePerSeatPaise: 12_000,
        currency: "INR",
        priceDisplay: "₹120.00",
      },
    });

    expect(response.body.data.id).toEqual(expect.any(String));

    expect(response.body.data.driverId).toEqual(expect.any(String));

    expect(response.body.data.routeLengthM).toBeGreaterThanOrEqual(500);

    const savedRide = await RideModel.findById(response.body.data.id);

    expect(savedRide).not.toBeNull();
    expect(savedRide!.status).toBe("SCHEDULED");
    expect(savedRide!.seatsAvailable).toBe(3);
  });

  it("rejects ride creation without authentication", async () => {
    const response = await request(app).post("/v1/rides").send(validRideBody());

    expect(response.status).toBe(401);
    expect(await RideModel.countDocuments()).toBe(0);
  });

  it("rejects ride creation for a passenger-only user", async () => {
    const accessToken = await registerAndLogin(
      "ride.passenger@example.com",
      false,
    );

    const response = await request(app)
      .post("/v1/rides")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validRideBody());

    expectApiError(
      response,
      403,
      "FORBIDDEN",
      "Driver capability is required to create a ride",
    );

    expect(await RideModel.countDocuments()).toBe(0);
  });

  it("rejects invalid seat capacity", async () => {
    const accessToken = await registerAndLogin(
      "invalid.seats@example.com",
      true,
    );

    const response = await request(app)
      .post("/v1/rides")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...validRideBody(),
        seatsTotal: 9,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Invalid ride data");
    expect(await RideModel.countDocuments()).toBe(0);
  });

  it("rejects invalid route coordinates", async () => {
    const accessToken = await registerAndLogin(
      "invalid.route@example.com",
      true,
    );

    const response = await request(app)
      .post("/v1/rides")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...validRideBody(),
        route: {
          type: "LineString",
          coordinates: [
            [181, 12.9716],
            [77.6046, 12.9716],
          ],
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Invalid ride data");
    expect(await RideModel.countDocuments()).toBe(0);
  });

  it("rejects a route shorter than five hundred metres", async () => {
    const accessToken = await registerAndLogin("short.route@example.com", true);

    const response = await request(app)
      .post("/v1/rides")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...validRideBody(),
        route: {
          type: "LineString",
          coordinates: [
            [77.5946, 12.9716],
            [77.595, 12.9716],
          ],
        },
      });

    expect(response.status).toBe(400);

    expect(response.body.error.message).toBe(
      "Route must be at least 500 metres long",
    );

    expect(await RideModel.countDocuments()).toBe(0);
  });

  it("rejects client-controlled protected fields", async () => {
    const accessToken = await registerAndLogin(
      "protected.fields@example.com",
      true,
    );

    const response = await request(app)
      .post("/v1/rides")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...validRideBody(),
        status: "COMPLETED",
        seatsAvailable: 99,
        routeLengthM: 1,
        driverId: "507f1f77bcf86cd799439011",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Invalid ride data");
    expect(await RideModel.countDocuments()).toBe(0);
  });

  it("rejects consecutive duplicate route coordinates", async () => {
    const accessToken = await registerAndLogin(
      "duplicate.route@example.com",
      true,
    );

    const response = await request(app)
      .post("/v1/rides")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...validRideBody(),
        route: {
          type: "LineString",
          coordinates: [
            [77.5946, 12.9716],
            [77.6046, 12.9716],
            [77.6046, 12.9716],
            [77.6146, 12.9716],
          ],
        },
      });

    expect(response.status).toBe(400);
    expect(await RideModel.countDocuments()).toBe(0);
  });

  it("rejects a route crossing the antimeridian", async () => {
    const accessToken = await registerAndLogin(
      "antimeridian.route@example.com",
      true,
    );

    const response = await request(app)
      .post("/v1/rides")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...validRideBody(),
        route: {
          type: "LineString",
          coordinates: [
            [179.9, 10],
            [-179.9, 10],
          ],
        },
      });

    expect(response.status).toBe(400);
    expect(await RideModel.countDocuments()).toBe(0);
  });

  it("allows non-consecutive repeated coordinates for looping routes", async () => {
    const accessToken = await registerAndLogin(
      "looping.route@example.com",
      true,
    );

    const response = await request(app)
      .post("/v1/rides")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...validRideBody(),
        route: {
          type: "LineString",
          coordinates: [
            [77.5946, 12.9716],
            [77.6046, 12.9716],
            [77.5946, 12.9716],
          ],
        },
      });

    expect(response.status).toBe(201);
    expect(await RideModel.countDocuments()).toBe(1);
  });

  it("returns a ride by ID for an authenticated user", async () => {
    const accessToken = await createTestAccessToken(
      "get.ride@example.com",
      true,
    );

    const createResponse = await request(app)
      .post("/v1/rides")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(validRideBody())
      .expect(201);

    const rideId = createResponse.body.data.id;

    const response = await request(app)
      .get(`/v1/rides/${rideId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: rideId,
        driverId: createResponse.body.data.driverId,
        status: "SCHEDULED",
        origin: [77.5946, 12.9716],
        destination: [77.6046, 12.9716],
        seatsTotal: 3,
        seatsAvailable: 3,
        pricePerSeatPaise: 12_000,
        currency: "INR",
        priceDisplay: "₹120.00",
      },
    });

    expect(response.body.data.routeLengthM).toBeGreaterThanOrEqual(500);

    expect(response.body.data).not.toHaveProperty("_id");
    expect(response.body.data).not.toHaveProperty("__v");
  });

  it("rejects ride retrieval without authentication", async () => {
    const response = await request(app)
      .get("/v1/rides/507f1f77bcf86cd799439011");

    expectApiError(
      response,
      401,
      "UNAUTHENTICATED",
      "Authorization header is required",
    );
  });

  it("rejects a malformed ride ID", async () => {
    const accessToken = await createTestAccessToken(
      "invalid.ride.id@example.com",
      false,
    );

    const response = await request(app)
      .get("/v1/rides/not-a-valid-object-id")
      .set("Authorization", `Bearer ${accessToken}`);

    expectApiError(
      response,
      400,
      "VALIDATION_ERROR",
      "Invalid ride ID",
    );
  });

  it("returns 404 when the ride does not exist", async () => {
    const accessToken = await createTestAccessToken(
      "missing.ride@example.com",
      false,
    );

    const response = await request(app)
      .get("/v1/rides/507f1f77bcf86cd799439011")
      .set("Authorization", `Bearer ${accessToken}`);

    expectApiError(
      response,
      404,
      "NOT_FOUND",
      "Ride not found",
    );
  });
});
