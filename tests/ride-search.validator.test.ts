import { describe, expect, it } from "vitest";
import { searchRidesQuerySchema } from "../src/validators/ride-search.validator";

describe("Ride search query validation", () => {
  it("accepts the required pickup coordinates and applies defaults", () => {
    const result = searchRidesQuerySchema.safeParse({
      pickupLng: "77.5946",
      pickupLat: "12.9716",
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.data).toEqual({
      pickupLng: 77.5946,
      pickupLat: 12.9716,
      maxWalkM: 1_000,
      seats: 1,
      limit: 20,
    });
  });

  it("accepts every supported search parameter", () => {
    const result = searchRidesQuerySchema.safeParse({
      pickupLng: "-122.4194",
      pickupLat: "37.7749",
      maxWalkM: "2500",
      departAfter: "2026-11-20T09:00:00.000Z",
      departBefore: "2026-11-21T09:00:00.000Z",
      seats: "3",
      limit: "40",
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.data).toEqual({
      pickupLng: -122.4194,
      pickupLat: 37.7749,
      maxWalkM: 2_500,
      departAfter: "2026-11-20T09:00:00.000Z",
      departBefore: "2026-11-21T09:00:00.000Z",
      seats: 3,
      limit: 40,
    });
  });

  it.each([
    ["pickupLng", "181"],
    ["pickupLng", "-181"],
    ["pickupLat", "61"],
    ["pickupLat", "-61"],
    ["pickupLng", "not-a-number"],
    ["pickupLat", ""],
  ])("rejects invalid coordinate %s=%s", (field, value) => {
    const result = searchRidesQuerySchema.safeParse({
      pickupLng: "77.5946",
      pickupLat: "12.9716",
      [field]: value,
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["maxWalkM", "0"],
    ["maxWalkM", "3001"],
    ["maxWalkM", "100.5"],
    ["seats", "0"],
    ["seats", "9"],
    ["limit", "0"],
    ["limit", "51"],
    ["limit", "-1"],
  ])("rejects invalid numeric option %s=%s", (field, value) => {
    const result = searchRidesQuerySchema.safeParse({
      pickupLng: "77.5946",
      pickupLat: "12.9716",
      [field]: value,
    });

    expect(result.success).toBe(false);
  });

  it("rejects malformed departure timestamps", () => {
    const result = searchRidesQuerySchema.safeParse({
      pickupLng: "77.5946",
      pickupLat: "12.9716",
      departAfter: "tomorrow morning",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported drop-off parameters", () => {
    const result = searchRidesQuerySchema.safeParse({
      pickupLng: "77.5946",
      pickupLat: "12.9716",
      dropoffLng: "77.6046",
      dropoffLat: "12.9816",
    });

    expect(result.success).toBe(false);
  });

  it("requires both pickup coordinates", () => {
    const missingLongitude = searchRidesQuerySchema.safeParse({
      pickupLat: "12.9716",
    });

    const missingLatitude = searchRidesQuerySchema.safeParse({
      pickupLng: "77.5946",
    });

    expect(missingLongitude.success).toBe(false);
    expect(missingLatitude.success).toBe(false);
  });
});