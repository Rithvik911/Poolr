import { describe, expect, it } from "vitest";
import { formatInr, rupeesToPaise } from "./format";

describe("money helpers", () => {
  it.each([["120", 12_000], ["120.5", 12_050], ["1,200.05", 120_005], ["0.01", 1]])("turns %s rupees into exact integer paise", (input, expected) => expect(rupeesToPaise(input)).toBe(expected));
  it.each(["12.999", "-1", "hello", "1e3"])("rejects unsafe rupee input %s", (input) => expect(rupeesToPaise(input)).toBeNull());
  it("uses Indian currency formatting", () => expect(formatInr(123_456_700)).toContain("12,34,567"));
});
