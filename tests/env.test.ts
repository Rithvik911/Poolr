
import { describe, expect, it } from "vitest";
import { validateEnv } from "../src/config/env";

const validEnv = {
  MONGO_URI: "mongodb://localhost:27017/poolr_test",
  JWT_SECRET: "a".repeat(32)
};

describe("Environment validation", () => {
  it("accepts valid configuration", () => {
    const result = validateEnv(validEnv);

    expect(result.MONGO_URI).toBe(validEnv.MONGO_URI);
    expect(result.JWT_SECRET).toBe(validEnv.JWT_SECRET);
  });

  it("rejects a missing MongoDB URI", () => {
    expect(() =>
      validateEnv({
        JWT_SECRET: validEnv.JWT_SECRET
      })
    ).toThrow();
  });

  it("rejects a missing JWT secret", () => {
    expect(() =>
      validateEnv({
        MONGO_URI: validEnv.MONGO_URI
      })
    ).toThrow();
  });

  it("rejects a short JWT secret", () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        JWT_SECRET: "short-secret"
      })
    ).toThrow();
  });
});
