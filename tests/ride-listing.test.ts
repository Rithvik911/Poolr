import { Types } from "mongoose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app";
import { RideModel } from "../src/models/ride.model";
import { UserModel } from "../src/models/user.model";
import { generateAccessToken } from "../src/utils/jwt";

async function createDriver(email: string) {
  const driver = await UserModel.create({
    name: "Ride Listing Driver",
    email,
    passwordHash: "unused-in-ride-listing-tests",
    isDriver: true,
  });

  return {
    driver,
    accessToken: generateAccessToken(driver._id.toString()),
  };
}

async function createRide(
  driverId: Types.ObjectId,
  departureTime: string,
  id = new Types.ObjectId(),
) {
  return RideModel.create({
    _id: id,
    driverId,
    route: {
      type: "LineString",
      coordinates: [
        [77.5946, 12.9716],
        [77.6046, 12.9716],
      ],
    },
    routeLengthM: 1_084,
    departureTime: new Date(departureTime),
    seatsTotal: 3,
    seatsAvailable: 3,
    pricePerSeatPaise: 12_000,
  });
}

describe("GET /me/rides", () => {
  it("requires authentication", async () => {
    const response = await request(app).get("/me/rides");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: "Authorization header missing",
    });
  });

  it("returns only the authenticated driver's rides as public DTOs", async () => {
    const owner = await createDriver("listing.owner@example.com");
    const other = await createDriver("listing.other@example.com");
    const ownRide = await createRide(
      owner.driver._id,
      "2026-12-01T10:00:00.000Z",
    );
    await createRide(other.driver._id, "2026-12-02T10:00:00.000Z");

    const response = await request(app)
      .get("/me/rides")
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      id: ownRide._id.toString(),
      driverId: owner.driver._id.toString(),
      origin: [77.5946, 12.9716],
      destination: [77.6046, 12.9716],
      currency: "INR",
      priceDisplay: "₹120.00",
    });
    expect(response.body.data[0]).not.toHaveProperty("_id");
    expect(response.body.data[0]).not.toHaveProperty("__v");
  });

  it("orders by departure time and then ID, both descending", async () => {
    const { driver, accessToken } = await createDriver(
      "listing.order@example.com",
    );
    const older = new Types.ObjectId("100000000000000000000001");
    const tiedLower = new Types.ObjectId("200000000000000000000001");
    const tiedHigher = new Types.ObjectId("200000000000000000000002");
    await createRide(driver._id, "2026-12-01T10:00:00.000Z", older);
    await createRide(driver._id, "2026-12-02T10:00:00.000Z", tiedLower);
    await createRide(driver._id, "2026-12-02T10:00:00.000Z", tiedHigher);

    const response = await request(app)
      .get("/me/rides")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data.map((ride: { id: string }) => ride.id)).toEqual([
      tiedHigher.toString(),
      tiedLower.toString(),
      older.toString(),
    ]);
  });

  it("paginates across a departure-time tie without gaps or duplicates", async () => {
    const { driver, accessToken } = await createDriver(
      "listing.pagination@example.com",
    );
    const ids = Array.from(
      { length: 12 },
      (_, index) =>
        new Types.ObjectId(
          `3000000000000000000000${index.toString(16).padStart(2, "0")}`,
        ),
    );

    await Promise.all(
      ids.map((id) =>
        createRide(driver._id, "2026-12-03T10:00:00.000Z", id),
      ),
    );

    const firstPage = await request(app)
      .get("/me/rides")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(firstPage.body.data).toHaveLength(10);
    expect(firstPage.body.pagination).toMatchObject({
      limit: 10,
      hasMore: true,
    });
    expect(firstPage.body.pagination.nextCursor).toEqual(expect.any(String));

    const secondPage = await request(app)
      .get("/me/rides")
      .query({ cursor: firstPage.body.pagination.nextCursor })
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(secondPage.body.data).toHaveLength(2);
    expect(secondPage.body.pagination).toEqual({
      limit: 10,
      hasMore: false,
      nextCursor: null,
    });

    const returnedIds = [...firstPage.body.data, ...secondPage.body.data].map(
      (ride: { id: string }) => ride.id,
    );
    const expectedIds = ids.map(String).reverse();

    expect(returnedIds).toEqual(expectedIds);
    expect(new Set(returnedIds).size).toBe(12);
  });

  it("honours an explicit limit", async () => {
    const { driver, accessToken } = await createDriver(
      "listing.limit@example.com",
    );
    await Promise.all([
      createRide(driver._id, "2026-12-01T10:00:00.000Z"),
      createRide(driver._id, "2026-12-02T10:00:00.000Z"),
      createRide(driver._id, "2026-12-03T10:00:00.000Z"),
    ]);

    const response = await request(app)
      .get("/me/rides")
      .query({ limit: "2" })
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data).toHaveLength(2);
    expect(response.body.pagination.limit).toBe(2);
    expect(response.body.pagination.hasMore).toBe(true);
  });

  it("accepts the maximum limit of fifty", async () => {
    const { accessToken } = await createDriver(
      "listing.maximum-limit@example.com",
    );

    const response = await request(app)
      .get("/me/rides")
      .query({ limit: "50" })
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.pagination.limit).toBe(50);
  });

  it.each(["0", "01", "1.5", "51", " 10", "10 "])(
    "rejects the invalid limit %j",
    async (limit) => {
      const { accessToken } = await createDriver(
        `listing.invalid-limit-${Buffer.from(limit).toString("hex")}@example.com`,
      );

      const response = await request(app)
        .get("/me/rides")
        .query({ limit })
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid ride listing query");
    },
  );

  it("rejects unknown query parameters", async () => {
    const { accessToken } = await createDriver(
      "listing.unknown-query@example.com",
    );

    const response = await request(app)
      .get("/me/rides")
      .query({ offset: "10" })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid ride listing query");
  });

  it.each([
    "not+base64",
    Buffer.from("not JSON").toString("base64url"),
    Buffer.from(
      JSON.stringify({ departureTime: "2026-12-01T10:00:00.000Z" }),
    ).toString("base64url"),
    Buffer.from(
      JSON.stringify({
        departureTime: "2026-12-01T10:00:00.000+00:00",
        id: "507f1f77bcf86cd799439011",
      }),
    ).toString("base64url"),
    Buffer.from(
      JSON.stringify({
        departureTime: "2026-12-01T10:00:00.000Z",
        id: "507F1F77BCF86CD799439011",
      }),
    ).toString("base64url"),
    Buffer.from(
      JSON.stringify({
        departureTime: "2026-12-01T10:00:00.000Z",
        id: "507f1f77bcf86cd799439011",
        driverId: "507f1f77bcf86cd799439012",
      }),
    ).toString("base64url"),
  ])("rejects a malformed cursor", async (cursor) => {
    const { accessToken } = await createDriver(
      `listing.invalid-cursor-${new Types.ObjectId()}@example.com`,
    );

    const response = await request(app)
      .get("/me/rides")
      .query({ cursor })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: "Invalid ride cursor",
    });
  });

  it("returns an empty final page when the driver has no rides", async () => {
    const { accessToken } = await createDriver(
      "listing.empty@example.com",
    );

    const response = await request(app)
      .get("/me/rides")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: [],
      pagination: {
        limit: 10,
        hasMore: false,
        nextCursor: null,
      },
    });
  });
});
