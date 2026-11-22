import { describe, expect, it } from "vitest";
import { normalizeApiError } from "./errors";

describe("API error normalisation", () => {
  it("reads the correlated final envelope", () => {
    const error = normalizeApiError({ error: { code: "RATE_LIMITED", message: "Wait", details: {}, requestId: "req-1" } }, 429);
    expect(error).toMatchObject({ code: "RATE_LIMITED", message: "Wait", requestId: "req-1", status: 429 });
  });
  it("reads the legacy success false envelope", () => {
    const error = normalizeApiError({ success: false, message: "Nope" }, 400);
    expect(error).toMatchObject({ code: "REQUEST_FAILED", message: "Nope", status: 400 });
  });
});
