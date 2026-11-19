import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app";
import { RideModel } from "../src/models/ride.model";
import { UserModel } from "../src/models/user.model";
import { generateAccessToken } from "../src/utils/jwt";

const PICKUP = [77.5946, 12.9716] as const;

async function createAuthenticatedUser(email: string) {
  const user = await UserModel.create({
    name: "Ride Search User",
    email,
    passwordHash: "unused-in-ride-search-tests",
    isDriver: false,
  });

  return {
    user,
    accessToken: generateAccessToken(user._id.toString()),
  };
}

function futureSearchWindow() {
  const departAfter = new Date(Date.now() + 60 * 60 * 1_000);
  const departureTime = new Date(
    departAfter.getTime() + 60 * 60 * 1_000,
  );
  const departBefore = new Date(
    departAfter.getTime() + 2 * 60 * 60 * 1_000,
  );

  return { departAfter, departureTime, departBefore };
}

describe("GET /rides/search", () => {
  it("requires authentication", async () => {
    const response = await request(app)
      .get("/rides/search")
      .query({
        pickupLng: PICKUP[0],
        pickupLat: PICKUP[1],
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: "Authorization header missing",
    });
  });

  it("matches the fixed search route before the dynamic ride ID route", async () => {
    const { accessToken } = await createAuthenticatedUser(
      "search.route@example.com",
    );

    const response = await request(app)
      .get("/rides/search")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Invalid ride search query",
    );
  });

  it("rejects unsupported or malformed query parameters", async () => {
    const { accessToken } = await createAuthenticatedUser(
      "search.validation@example.com",
    );

    const response = await request(app)
      .get("/rides/search")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({
        pickupLng: PICKUP[0],
        pickupLat: PICKUP[1],
        dropoffLng: 77.6046,
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: "Invalid ride search query",
    });
    expect(response.body.errors).toBeDefined();
  });

  it("returns a controlled error for an invalid departure window", async () => {
    const { accessToken } = await createAuthenticatedUser(
      "search.window@example.com",
    );

    const response = await request(app)
      .get("/rides/search")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({
        pickupLng: PICKUP[0],
        pickupLat: PICKUP[1],
        departAfter: "2026-11-21T09:00:00.000Z",
        departBefore: "2026-11-20T09:00:00.000Z",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message:
        "Departure window must be ordered and no longer than 7 days",
    });
  });

  it("returns public ride data with the calculated pickup walk", async () => {
    const { accessToken } = await createAuthenticatedUser(
      "search.success@example.com",
    );
    const driver = await UserModel.create({
      name: "Search Driver",
      email: "search.driver@example.com",
      passwordHash: "unused-in-ride-search-tests",
      isDriver: true,
    });
    const { departAfter, departureTime, departBefore } =
      futureSearchWindow();
    const ride = await RideModel.create({
      driverId: driver._id,
      status: "SCHEDULED",
      route: {
        type: "LineString",
        coordinates: [
          [77.59, PICKUP[1]],
          [77.6, PICKUP[1]],
        ],
      },
      routeLengthM: 1_084,
      departureTime,
      seatsTotal: 3,
      seatsAvailable: 3,
      pricePerSeatPaise: 12_000,
    });

    const response = await request(app)
      .get("/rides/search")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({
        pickupLng: PICKUP[0],
        pickupLat: PICKUP[1],
        departAfter: departAfter.toISOString(),
        departBefore: departBefore.toISOString(),
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        truncated: false,
        results: [
          {
            id: ride._id.toString(),
            driverId: driver._id.toString(),
            status: "SCHEDULED",
            origin: [77.59, PICKUP[1]],
            destination: [77.6, PICKUP[1]],
            departureTime: departureTime.toISOString(),
            seatsTotal: 3,
            seatsAvailable: 3,
            pricePerSeatPaise: 12_000,
            currency: "INR",
            priceDisplay: "₹120.00",
            walkPickupM: expect.any(Number),
          },
        ],
      },
    });
    expect(response.body.data.results[0]).not.toHaveProperty(
      "_id",
    );
    expect(response.body.data.results[0]).not.toHaveProperty(
      "__v",
    );
    expect(
      response.body.data.results[0].walkPickupM,
    ).toBeLessThan(0.1);
  });

  it("returns an empty result set when no ride matches", async () => {
    const { accessToken } = await createAuthenticatedUser(
      "search.empty@example.com",
    );
    const { departAfter, departBefore } = futureSearchWindow();

    const response = await request(app)
      .get("/rides/search")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({
        pickupLng: PICKUP[0],
        pickupLat: PICKUP[1],
        departAfter: departAfter.toISOString(),
        departBefore: departBefore.toISOString(),
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        results: [],
        truncated: false,
      },
    });
  });
});
