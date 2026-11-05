import { describe, expect, it } from "vitest";
import { createRideSchema } from "../src/validators/ride.validator";

function validRideInput() {
  return {
    route: {
      type: "LineString",
      coordinates: [
        [77.5946, 12.9716],
        [77.6046, 12.9716]
      ]
    },
    departureTime: "2026-12-01T10:00:00.000Z",
    seatsTotal: 3,
    pricePerSeatPaise: 12_000
  };
}

describe("Ride request validation", () => {
  it("accepts a valid ride request", () => {
    const result = createRideSchema.safeParse(
      validRideInput()
    );

    expect(result.success).toBe(true);
  });

  it.each([1, 8])(
    "accepts the seat boundary %s",
    (seatsTotal) => {
      const result = createRideSchema.safeParse({
        ...validRideInput(),
        seatsTotal
      });

      expect(result.success).toBe(true);
    }
  );

  it.each([0, 9, 1.5])(
    "rejects invalid seat capacity %s",
    (seatsTotal) => {
      const result = createRideSchema.safeParse({
        ...validRideInput(),
        seatsTotal
      });

      expect(result.success).toBe(false);
    }
  );

  it.each([0, 1_000_000])(
    "accepts the price boundary %s paise",
    (pricePerSeatPaise) => {
      const result = createRideSchema.safeParse({
        ...validRideInput(),
        pricePerSeatPaise
      });

      expect(result.success).toBe(true);
    }
  );

  it.each([-1, 1_000_001, 10.5])(
    "rejects invalid price %s paise",
    (pricePerSeatPaise) => {
      const result = createRideSchema.safeParse({
        ...validRideInput(),
        pricePerSeatPaise
      });

      expect(result.success).toBe(false);
    }
  );

  it.each([
    "not-a-date",
    "2026-12-01",
    "2026-12-01T10:00:00"
  ])(
    "rejects invalid or timezone-free departure %s",
    (departureTime) => {
      const result = createRideSchema.safeParse({
        ...validRideInput(),
        departureTime
      });

      expect(result.success).toBe(false);
    }
  );

  it("accepts a departure with an explicit UTC offset", () => {
    const result = createRideSchema.safeParse({
      ...validRideInput(),
      departureTime: "2026-12-01T15:30:00+05:30"
    });

    expect(result.success).toBe(true);
  });

  it("rejects a route with the wrong GeoJSON type", () => {
    const result = createRideSchema.safeParse({
      ...validRideInput(),
      route: {
        type: "Point",
        coordinates: [
          [77.5946, 12.9716],
          [77.6046, 12.9716]
        ]
      }
    });

    expect(result.success).toBe(false);
  });

  it("rejects a route containing fewer than two coordinates", () => {
    const result = createRideSchema.safeParse({
      ...validRideInput(),
      route: {
        type: "LineString",
        coordinates: [
          [77.5946, 12.9716]
        ]
      }
    });

    expect(result.success).toBe(false);
  });

  it("accepts exactly five hundred coordinates", () => {
    const coordinates = Array.from(
      { length: 500 },
      (_, index) => [
        77 + index * 0.0001,
        12
      ]
    );

    const result = createRideSchema.safeParse({
      ...validRideInput(),
      route: {
        type: "LineString",
        coordinates
      }
    });

    expect(result.success).toBe(true);
  });

  it("rejects more than five hundred coordinates", () => {
    const coordinates = Array.from(
      { length: 501 },
      (_, index) => [
        77 + index * 0.0001,
        12
      ]
    );

    const result = createRideSchema.safeParse({
      ...validRideInput(),
      route: {
        type: "LineString",
        coordinates
      }
    });

    expect(result.success).toBe(false);
  });

  it.each([
    [180.1, 12],
    [-180.1, 12],
    [77, 60.1],
    [77, -60.1]
  ])(
    "rejects an out-of-range coordinate [%s, %s]",
    (longitude, latitude) => {
      const result = createRideSchema.safeParse({
        ...validRideInput(),
        route: {
          type: "LineString",
          coordinates: [
            [longitude, latitude],
            [77.6046, 12.9716]
          ]
        }
      });

      expect(result.success).toBe(false);
    }
  );

  it.each([
    "driverId",
    "status",
    "seatsAvailable",
    "routeLengthM",
    "createdAt",
    "updatedAt"
  ])(
    "rejects the protected client field %s",
    (protectedField) => {
      const result = createRideSchema.safeParse({
        ...validRideInput(),
        [protectedField]: "client-controlled-value"
      });

      expect(result.success).toBe(false);
    }
  );
});