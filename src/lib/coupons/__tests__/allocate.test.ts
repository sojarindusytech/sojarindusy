import { describe, expect, it } from "vitest";
import { allocateDiscount } from "../allocate";

const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

describe("allocateDiscount", () => {
  it("splits in proportion to line value", () => {
    expect(
      allocateDiscount(
        [
          { lineTotal: 3000, eligible: true },
          { lineTotal: 1000, eligible: true },
        ],
        400
      )
    ).toEqual([300, 100]);
  });

  it("gives nothing to lines the coupon does not apply to", () => {
    expect(
      allocateDiscount(
        [
          { lineTotal: 5000, eligible: false },
          { lineTotal: 1000, eligible: true },
          { lineTotal: 1000, eligible: true },
        ],
        150
      )
    ).toEqual([0, 75, 75]);
  });

  it("always adds up exactly, handing leftover paise to the largest remainders", () => {
    const shares = allocateDiscount(
      [
        { lineTotal: 100, eligible: true },
        { lineTotal: 100, eligible: true },
        { lineTotal: 100, eligible: true },
      ],
      10
    );
    expect(shares).toEqual([3.34, 3.33, 3.33]); // ties go to the earlier line
    expect(sum(shares)).toBe(10);

    const odd = allocateDiscount(
      [
        { lineTotal: 999.99, eligible: true },
        { lineTotal: 1000, eligible: true },
      ],
      139.99
    );
    expect(sum(odd)).toBe(139.99);
    expect(odd).toEqual([69.99, 70]);
  });

  it("never gives a line more than its value, and caps the total at the eligible value", () => {
    expect(
      allocateDiscount(
        [
          { lineTotal: 50, eligible: true },
          { lineTotal: 900, eligible: false },
        ],
        80
      )
    ).toEqual([50, 0]);
  });

  it("returns zeros for no discount, no eligible lines or an empty cart", () => {
    expect(allocateDiscount([{ lineTotal: 100, eligible: true }], 0)).toEqual([0]);
    expect(allocateDiscount([{ lineTotal: 100, eligible: false }], 10)).toEqual([0]);
    expect(allocateDiscount([], 10)).toEqual([]);
  });

  it("is exact over many awkward lines", () => {
    const lines = Array.from({ length: 37 }, (_, i) => ({ lineTotal: 12.37 * (i + 1), eligible: i % 3 !== 0 }));
    const shares = allocateDiscount(lines, 271.43);
    expect(sum(shares)).toBe(271.43);
    shares.forEach((s, i) => {
      expect(Math.abs(s * 100 - Math.round(s * 100))).toBeLessThan(1e-6); // whole paise
      if (!lines[i].eligible) expect(s).toBe(0);
      expect(s).toBeLessThanOrEqual(lines[i].lineTotal);
    });
  });
});
