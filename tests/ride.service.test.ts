import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { RideModel } from "../src/models/ride.model";
import { UserModel } from "../src/models/user.model";
import {
  createRide,
  DriverRequiredError,
  InvalidDepartureTimeError,
  RouteTooShortError
} from "../src/services/ride.service";
import type { CreateRideInput } from "../src/validators/ride.validator";

const NOW = new Date("2026-01-01T10:00:00.000Z");

function buildRideInput(
  overrides: Partial<CreateRideInput> = {}
): CreateRideInput {
  return {
    route: {
      type: "LineString",
      coordinates: [
        [77.5946, 12.9716],
        [77.6046, 12.9716]
      ]
    },
    departureTime: "2026-01-01T11:00:00.000Z",
    seatsTotal: 3,
    pricePerSeatPaise: 12_000,
    ...overrides
  };
}

async function createTestUser(
  email: string,
  isDriver: boolean
) {
  return UserModel.create({
    name: "Test User",
    email,
    passwordHash: "test-password-hash",
    isDriver
  });
}

describe("Ride service", () => {
  it("creates a scheduled ride for a driver", async () => {
    const driver = await createTestUser(
      "driver@example.com",
      true
    );

    const input = buildRideInput();

    const ride = await createRide(
      driver._id.toString(),
      input,
      NOW
    );

    expect(ride.driverId.toString()).toBe(
      driver._id.toString()
    );

    expect(ride.status).toBe("SCHEDULED");
    expect(ride.seatsTotal).toBe(3);
    expect(ride.seatsAvailable).toBe(3);
    expect(ride.pricePerSeatPaise).toBe(12_000);
    expect(ride.routeLengthM).toBeGreaterThanOrEqual(500);

    expect(ride.departureTime.toISOString()).toBe(
      input.departureTime
    );

    expect(await RideModel.countDocuments()).toBe(1);
  });

  it("derives protected fields instead of accepting them from the client", async () => {
    const driver = await createTestUser(
      "protected-fields@example.com",
      true
    );

    const ride = await createRide(
      driver._id.toString(),
      buildRideInput({
        seatsTotal: 4
      }),
      NOW
    );

    expect(ride.driverId.toString()).toBe(
      driver._id.toString()
    );

    expect(ride.status).toBe("SCHEDULED");
    expect(ride.seatsAvailable).toBe(4);
    expect(ride.routeLengthM).toBeGreaterThanOrEqual(500);
  });

  it("rejects ride creation for a passenger-only user", async () => {
    const passenger = await createTestUser(
      "passenger@example.com",
      false
    );

    await expect(
      createRide(
        passenger._id.toString(),
        buildRideInput(),
        NOW
      )
    ).rejects.toBeInstanceOf(DriverRequiredError);

    expect(await RideModel.countDocuments()).toBe(0);
  });

  it("rejects ride creation when the user does not exist", async () => {
    const missingUserId = new Types.ObjectId().toString();

    await expect(
      createRide(
        missingUserId,
        buildRideInput(),
        NOW
      )
    ).rejects.toBeInstanceOf(DriverRequiredError);

    expect(await RideModel.countDocuments()).toBe(0);
  });

  it("accepts a departure exactly five minutes away", async () => {
    const driver = await createTestUser(
      "five-minute-boundary@example.com",
      true
    );

    const ride = await createRide(
      driver._id.toString(),
      buildRideInput({
        departureTime: "2026-01-01T10:05:00.000Z"
      }),
      NOW
    );

    expect(ride.departureTime.toISOString()).toBe(
      "2026-01-01T10:05:00.000Z"
    );
  });

  it("rejects a departure less than five minutes away", async () => {
    const driver = await createTestUser(
      "early-driver@example.com",
      true
    );

    await expect(
      createRide(
        driver._id.toString(),
        buildRideInput({
          departureTime: "2026-01-01T10:04:59.999Z"
        }),
        NOW
      )
    ).rejects.toBeInstanceOf(InvalidDepartureTimeError);

    expect(await RideModel.countDocuments()).toBe(0);
  });

  it("accepts a departure exactly ninety days away", async () => {
    const driver = await createTestUser(
      "ninety-day-boundary@example.com",
      true
    );

    const ride = await createRide(
      driver._id.toString(),
      buildRideInput({
        departureTime: "2026-04-01T10:00:00.000Z"
      }),
      NOW
    );

    expect(ride.departureTime.toISOString()).toBe(
      "2026-04-01T10:00:00.000Z"
    );
  });

  it("rejects a departure more than ninety days away", async () => {
    const driver = await createTestUser(
      "late-driver@example.com",
      true
    );

    await expect(
      createRide(
        driver._id.toString(),
        buildRideInput({
          departureTime: "2026-04-01T10:00:00.001Z"
        }),
        NOW
      )
    ).rejects.toBeInstanceOf(InvalidDepartureTimeError);

    expect(await RideModel.countDocuments()).toBe(0);
  });

  it("rejects a route shorter than five hundred metres", async () => {
    const driver = await createTestUser(
      "short-route@example.com",
      true
    );

    await expect(
      createRide(
        driver._id.toString(),
        buildRideInput({
          route: {
            type: "LineString",
            coordinates: [
              [77.5946, 12.9716],
              [77.595, 12.9716]
            ]
          }
        }),
        NOW
      )
    ).rejects.toBeInstanceOf(RouteTooShortError);

    expect(await RideModel.countDocuments()).toBe(0);
  });

  it("prevents all immutable Ride fields from being changed", async () => {
    const driver = await createTestUser(
      "immutable.owner@example.com",
      true
    );

    const otherDriver = await createTestUser(
      "different.owner@example.com",
      true
    );

    const ride = await createRide(
      driver._id.toString(),
      buildRideInput(),
      NOW
    );

    const originalCoordinates = JSON.parse(
      JSON.stringify(ride.route!.coordinates)
    ) as number[][];

    const originalDepartureTime =
      ride.departureTime.toISOString();

    const originalRouteLengthM = ride.routeLengthM;

    const updatedRide = await RideModel.findByIdAndUpdate(
      ride._id,
      {
        $set: {
          driverId: otherDriver._id,
          "route.coordinates": [
            [80, 13],
            [81, 14]
          ],
          routeLengthM: 999_999,
          departureTime: new Date(
            "2026-02-01T10:00:00.000Z"
          ),
          seatsTotal: 8,
          pricePerSeatPaise: 999_999
        }
      },
      {
      returnDocument: "after",
        runValidators: true
      }
    );

    expect(updatedRide).not.toBeNull();

    expect(updatedRide!.driverId.toString()).toBe(
      driver._id.toString()
    );

    const persistedCoordinates = JSON.parse(
      JSON.stringify(updatedRide!.route!.coordinates)
    ) as number[][];

    expect(persistedCoordinates).toEqual(
      originalCoordinates
    );

    expect(updatedRide!.routeLengthM).toBe(
      originalRouteLengthM
    );

    expect(
      updatedRide!.departureTime.toISOString()
    ).toBe(originalDepartureTime);

    expect(updatedRide!.seatsTotal).toBe(3);
    expect(updatedRide!.pricePerSeatPaise).toBe(12_000);
  });

  it("allows lifecycle status and available seats to change", async () => {
    const driver = await createTestUser(
      "mutable.fields@example.com",
      true
    );

    const ride = await createRide(
      driver._id.toString(),
      buildRideInput(),
      NOW
    );

    const updatedRide = await RideModel.findByIdAndUpdate(
      ride._id,
      {
        $set: {
          status: "STARTED",
          seatsAvailable: 1
        }
      },
      {
      returnDocument: "after",
        runValidators: true
      }
    );

    expect(updatedRide).not.toBeNull();
    expect(updatedRide!.status).toBe("STARTED");
    expect(updatedRide!.seatsAvailable).toBe(1);
  });
});
