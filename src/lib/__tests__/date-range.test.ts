/**
 * Tests for date-range filtering.
 *   npm test
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { isWithinDateRange, resolveDateRange } from "../date-range";

// Fixed "now" so the assertions do not drift with the wall clock.
const NOW = new Date("2026-09-28T14:30:00");
const on = (iso: string) => iso;

describe("date-range", () => {
  it("\"all\" lets everything through, including a missing date", () => {
    assert.equal(isWithinDateRange(on("2020-01-01T00:00:00"), "all", undefined, undefined, NOW), true);
    assert.equal(isWithinDateRange(null, "all", undefined, undefined, NOW), true);
  });

  it("today: from local midnight, so earlier today counts", () => {
    assert.equal(isWithinDateRange("2026-09-28T00:00:01", "today", undefined, undefined, NOW), true);
    assert.equal(isWithinDateRange("2026-09-28T23:59:00", "today", undefined, undefined, NOW), true);
    assert.equal(isWithinDateRange("2026-09-27T23:59:59", "today", undefined, undefined, NOW), false);
  });

  it("7d includes today plus the 6 prior days (7 days total, not 8)", () => {
    assert.equal(isWithinDateRange("2026-09-22T00:00:00", "7d", undefined, undefined, NOW), true, "6 days ago is in");
    assert.equal(isWithinDateRange("2026-09-21T23:59:59", "7d", undefined, undefined, NOW), false, "7 days ago is out");
  });

  it("30d / 90d boundaries", () => {
    assert.equal(isWithinDateRange("2026-08-30T00:00:00", "30d", undefined, undefined, NOW), true);
    assert.equal(isWithinDateRange("2026-08-29T23:59:59", "30d", undefined, undefined, NOW), false);
    assert.equal(isWithinDateRange("2026-07-01T00:00:00", "90d", undefined, undefined, NOW), true);
    assert.equal(isWithinDateRange("2026-06-30T23:59:59", "90d", undefined, undefined, NOW), false);
  });

  it("custom: both bounds inclusive, single day covers the whole day", () => {
    assert.equal(isWithinDateRange("2026-09-10T00:00:00", "custom", "2026-09-10", "2026-09-10", NOW), true);
    assert.equal(isWithinDateRange("2026-09-10T23:59:00", "custom", "2026-09-10", "2026-09-10", NOW), true,
      "end bound must cover the full day, not midnight");
    assert.equal(isWithinDateRange("2026-09-11T00:00:00", "custom", "2026-09-10", "2026-09-10", NOW), false);
    assert.equal(isWithinDateRange("2026-09-09T23:59:59", "custom", "2026-09-10", "2026-09-10", NOW), false);
  });

  it("custom with one side open", () => {
    assert.equal(isWithinDateRange("2030-01-01T00:00:00", "custom", "2026-09-10", "", NOW), true, "open end");
    assert.equal(isWithinDateRange("2000-01-01T00:00:00", "custom", "", "2026-09-10", NOW), true, "open start");
    assert.equal(isWithinDateRange("2026-09-11T00:00:00", "custom", "", "2026-09-10", NOW), false);
  });

  it("custom with no bounds behaves like \"all\"", () => {
    assert.equal(isWithinDateRange("1999-01-01T00:00:00", "custom", "", "", NOW), true);
  });

  it("bad input is excluded rather than throwing", () => {
    assert.equal(isWithinDateRange("not-a-date", "7d", undefined, undefined, NOW), false);
    assert.equal(isWithinDateRange(null, "7d", undefined, undefined, NOW), false);
    assert.equal(isWithinDateRange(undefined, "today", undefined, undefined, NOW), false);
    assert.deepEqual(resolveDateRange("custom", "garbage", "also-bad", NOW), { start: null, end: null });
  });
});
