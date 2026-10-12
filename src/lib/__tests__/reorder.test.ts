/**
 * Tests for the auto purchase-order reorder decision.
 *   npm test
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { evaluateReorder, type ReorderDecision } from "../reorder";

/** The fields of a "do not order" decision (reason, misconfigured). */
const skipped = (d: ReorderDecision) => {
  if (d.shouldOrder) throw new Error("expected no order");
  return d;
};

const at = (currentStock: number, minQuantity: number, triggerQuantity: number) =>
  evaluateReorder({ currentStock, minQuantity, triggerQuantity });

describe("evaluateReorder", () => {
  it("Disabled by default: trigger_quantity 0 must never auto-order", () => {
    assert.equal(at(0, 500, 0).shouldOrder, false, "trigger 0 disables auto-ordering");
    assert.equal(at(0, 0, 0).shouldOrder, false, "all-zero SKU never orders");
    assert.match(skipped(at(0, 500, 0)).reason, /disabled/i);
    assert.equal(at(0, 500, -5).shouldOrder, false, "negative trigger is treated as disabled");
  });

  it("Threshold boundary is <=, not <", () => {
    assert.equal(at(101, 500, 100).shouldOrder, false, "one above trigger does not fire");
    assert.equal(at(100, 500, 100).shouldOrder, true, "exactly at trigger DOES fire");
    assert.equal(at(99, 500, 100).shouldOrder, true, "below trigger fires");
  });

  it("Quantity is min - trigger, NOT min - stock and NOT floored at MOQ", () => {
    {
      const d = at(100, 500, 100);
      assert.equal(d.shouldOrder && d.orderQuantity, 400);
    }
    {
      // Stock well below the trigger must not change the amount ordered.
      const d = at(3, 500, 100);
      assert.equal(d.shouldOrder && d.orderQuantity, 400, "order size is independent of current stock");
    }
    {
      const d = at(0, 10, 9);
      assert.equal(d.shouldOrder && d.orderQuantity, 1, "smallest valid order is 1 unit");
    }
  });

  it("Misconfiguration: min <= trigger must skip, never clamp to 1", () => {
    // stock must be at or below the trigger, or the earlier guard short-circuits first
    for (const [stock, min, trig] of [[90, 50, 100], [100, 100, 100], [3, 0, 5]] as const) {
      const d = at(stock, min, trig);
      assert.equal(d.shouldOrder, false, `min=${min} trigger=${trig} must not order`);
      assert.equal(skipped(d).misconfigured, true, `min=${min} trigger=${trig} flagged misconfigured`);
      assert.match(skipped(d).reason, /Misconfigured/);
    }
  });

  it("Non-numeric / missing config degrades to \"off\", never to a surprise order", () => {
    assert.equal(at(0, NaN, NaN).shouldOrder, false);
    assert.equal(at(0, undefined as unknown as number, undefined as unknown as number).shouldOrder, false);
  });
});
