import { describe, expect, it } from "vitest";
import { routeLengthM, validateRoute } from "./geo";

describe("route validation", () => {
  it("accepts a route longer than 500 metres", () => expect(validateRoute([[77.5946, 12.9716], [77.6046, 12.9716]])).toBeNull());
  it("rejects consecutive duplicate points", () => expect(validateRoute([[77.5946, 12.9716], [77.5946, 12.9716]])).toMatch(/identical/i));
  it("calculates a positive line length", () => expect(routeLengthM([[77.5946, 12.9716], [77.6046, 12.9716]])).toBeGreaterThan(500));
});
