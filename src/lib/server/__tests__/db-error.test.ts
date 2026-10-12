import { describe, expect, it } from "vitest";
import { parseDbError } from "../db-error";

describe("parseDbError", () => {
  it("reads the stable code and JSON detail of an application error", () => {
    expect(
      parseDbError({ code: "P0001", message: "PRICE_CHANGED", details: '{"sku":"TD-8","price":1000}' })
    ).toMatchObject({ code: "PRICE_CHANGED", detail: { sku: "TD-8", price: 1000 } });
  });

  it("names the constraint of a unique violation", () => {
    expect(
      parseDbError({ code: "23505", message: 'duplicate key value violates unique constraint "coupons_code_live_key"' })
    ).toMatchObject({ code: "UNIQUE_VIOLATION", detail: { constraint: "coupons_code_live_key" } });
  });

  it("never exposes unexpected database messages as a code", () => {
    const parsed = parseDbError({ code: "P0001", message: "something odd happened", details: "free text" });
    expect(parsed.code).toBe("DATABASE_ERROR");
    expect(parsed.detail).toEqual({});
    expect(parseDbError({ code: "42P01", message: 'relation "x" does not exist' }).code).toBe("DATABASE_ERROR");
  });
});
