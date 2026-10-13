import { describe, expect, it } from "vitest";
import { allowedStatuses, canTransition, isFinalStatus } from "../order-status";

// Must agree with transition_order_status() (see tests/db/migrations.test.ts).
describe("order status rules", () => {
  it("treats cancelled and returned as final", () => {
    expect(isFinalStatus("cancelled")).toBe(true);
    expect(isFinalStatus("returned")).toBe(true);
    expect(allowedStatuses("cancelled")).toEqual(["cancelled"]);
    expect(allowedStatuses("returned")).toEqual(["returned"]);
  });

  it("lets a delivered order only become returned", () => {
    expect(allowedStatuses("delivered").sort()).toEqual(["delivered", "returned"]);
  });

  it("allows returned only from shipped or delivered", () => {
    expect(canTransition("pending", "returned")).toBe(false);
    expect(canTransition("processing", "returned")).toBe(false);
    expect(canTransition("shipped", "returned")).toBe(true);
    expect(canTransition("delivered", "returned")).toBe(true);
  });

  it("lets orders that have not shipped move freely, ship, deliver or cancel", () => {
    expect(canTransition("pending", "shipped")).toBe(true);
    expect(canTransition("processing", "pending")).toBe(true);
    expect(canTransition("confirmed", "delivered")).toBe(true);
    expect(canTransition("pending", "cancelled")).toBe(true);
    expect(canTransition("delivered", "cancelled")).toBe(false);
  });

  it("lets a shipped order only be delivered or returned (stock is out, invoice raised)", () => {
    expect(allowedStatuses("shipped").sort()).toEqual(["delivered", "returned", "shipped"]);
    expect(canTransition("shipped", "processing")).toBe(false);
    expect(canTransition("shipped", "cancelled")).toBe(false);
  });

  it("always allows a same-status details update", () => {
    for (const s of ["pending", "delivered", "cancelled", "returned"] as const) {
      expect(canTransition(s, s)).toBe(true);
    }
  });
});
