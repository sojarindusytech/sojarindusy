/**
 * Self-check for the auto purchase-order reorder decision.
 *   npx tsx src/lib/__tests__/reorder.test.ts
 */
import assert from "node:assert/strict";
import { evaluateReorder } from "../reorder";

const at = (currentStock: number, minQuantity: number, triggerQuantity: number) =>
  evaluateReorder({ currentStock, minQuantity, triggerQuantity });

// --- Disabled by default: trigger_quantity 0 must never auto-order ---
assert.equal(at(0, 500, 0).shouldOrder, false, "trigger 0 disables auto-ordering");
assert.equal(at(0, 0, 0).shouldOrder, false, "all-zero SKU never orders");
assert.match((at(0, 500, 0) as any).reason, /disabled/i);
assert.equal(at(0, 500, -5).shouldOrder, false, "negative trigger is treated as disabled");

// --- Threshold boundary is <=, not < ---
assert.equal(at(101, 500, 100).shouldOrder, false, "one above trigger does not fire");
assert.equal(at(100, 500, 100).shouldOrder, true, "exactly at trigger DOES fire");
assert.equal(at(99, 500, 100).shouldOrder, true, "below trigger fires");

// --- Quantity is min - trigger, NOT min - stock and NOT floored at MOQ ---
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

// --- Misconfiguration: min <= trigger must skip, never clamp to 1 ---
// stock must be at or below the trigger, or the earlier guard short-circuits first
for (const [stock, min, trig] of [[90, 50, 100], [100, 100, 100], [3, 0, 5]] as const) {
  const d = at(stock, min, trig);
  assert.equal(d.shouldOrder, false, `min=${min} trigger=${trig} must not order`);
  assert.equal((d as any).misconfigured, true, `min=${min} trigger=${trig} flagged misconfigured`);
  assert.match((d as any).reason, /Misconfigured/);
}

// --- Non-numeric / missing config degrades to "off", never to a surprise order ---
assert.equal(at(0, NaN as any, NaN as any).shouldOrder, false);
assert.equal(at(0, undefined as any, undefined as any).shouldOrder, false);

console.log("reorder: all assertions passed");
