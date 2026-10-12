/**
 * Tests for invoice maths, reproducing the Hindco sample invoice
 * (SI/INV/25-26/04, ₹8,330.00).
 *   npm test
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  amountInWords,
  computeInvoice,
  financialYear,
  formatInvoiceNumber,
  normalizeCopies,
  resolveGstRate,
  stateCodeOf,
} from "../invoice";
import { placeOfSupplyFor } from "../indian-states";

const sampleItems = [
  { name: "SIH55E4A06050-5.0", hsn: "82090010", quantity: 1, unitPrice: 880, discountPct: 35 },
  { name: "SIH55E4A16100-16.0", hsn: "82090010", quantity: 1, unitPrice: 9980, discountPct: 35 },
];
const base = { defaultGstRate: 9 * 2, sellerStateCode: "24", placeOfSupplyStateCode: "24" };

describe("invoice maths", () => {
  it("Sample invoice, intra-state GST 18%", () => {
    {
      const { lines, totals, intraState } = computeInvoice({ ...base, items: sampleItems, gstEnabled: true });
      assert.equal(intraState, true);
      assert.equal(lines[0].discountAmount, 308);
      assert.equal(lines[0].taxable, 572);
      assert.equal(lines[0].cgst, 51.48);
      assert.equal(lines[0].sgst, 51.48);
      assert.equal(lines[0].amount, 674.96);
      assert.equal(lines[1].discountAmount, 3493);
      assert.equal(lines[1].taxable, 6487);
      assert.equal(lines[1].cgst, 583.83);
      assert.equal(lines[1].amount, 7654.66);
      assert.equal(totals.discountTotal, 3801);
      assert.equal(totals.taxableTotal, 7059);
      assert.equal(totals.cgstTotal, 635.31);
      assert.equal(totals.sgstTotal, 635.31);
      assert.equal(totals.subTotal, 8329.62);
      assert.equal(totals.roundOff, 0.38);
      assert.equal(totals.total, 8330);
      assert.equal(totals.youSaved, 4485.18, "discount incl. the GST it would have attracted");
      assert.equal(totals.taxSummary.length, 1);
      assert.equal(totals.taxSummary[0].rate, 18);
    }
  });

  it("Inter-state: IGST only", () => {
    {
      const { lines, totals, intraState } = computeInvoice({
        ...base,
        placeOfSupplyStateCode: "27",
        items: sampleItems,
        gstEnabled: true,
      });
      assert.equal(intraState, false);
      assert.equal(lines[0].cgst, 0);
      assert.equal(lines[0].igst, 102.96);
      assert.equal(totals.igstTotal, 1270.62);
      assert.equal(totals.total, 8330, "same grand total whichever tax head applies");
    }
  });

  it("Non-GST billing: no tax, total = taxable", () => {
    {
      const { totals, lines } = computeInvoice({ ...base, items: sampleItems, gstEnabled: false });
      assert.equal(lines[0].gstRate, 0);
      assert.equal(totals.cgstTotal + totals.sgstTotal + totals.igstTotal, 0);
      assert.equal(totals.total, 7059);
      assert.equal(totals.youSaved, 3801);
    }
  });

  it("Mixed per-SKU rates group in the tax summary; blank rate -> default", () => {
    {
      const { totals } = computeInvoice({
        ...base,
        gstEnabled: true,
        items: [
          { name: "A", quantity: 2, unitPrice: 100, gstRate: 12 },
          { name: "B", quantity: 1, unitPrice: 100, gstRate: null },
        ],
      });
      assert.deepEqual(totals.taxSummary.map((r) => r.rate), [12, 18]);
      assert.equal(totals.taxSummary[0].taxable, 200);
      assert.equal(totals.taxSummary[0].cgst, 12);
      assert.equal(totals.total, 200 + 24 + 118);
    }
  });

  it("Unknown state on either side is treated as intra-state", () => {
    assert.equal(computeInvoice({ ...base, placeOfSupplyStateCode: null, items: sampleItems, gstEnabled: true }).intraState, true);
    assert.equal(stateCodeOf("24-Gujarat"), "24");
    assert.equal(stateCodeOf("Gujarat"), null);
    assert.equal(resolveGstRate(null, 18), 18);
    assert.equal(resolveGstRate(0, 18), 0, "an explicit 0% SKU must not fall back to the default");
  });

  it("Garbage input is clamped, never NaN", () => {
    {
      const { totals } = computeInvoice({
        ...base,
        gstEnabled: true,
        items: [{ name: "x", quantity: -3, unitPrice: Number.NaN, discountPct: 500 }],
      });
      assert.equal(totals.total, 0);
    }
  });

  it("Amount in words", () => {
    assert.equal(amountInWords(8330), "Eight Thousand Three Hundred and Thirty Rupees only");
    assert.equal(amountInWords(12501), "Twelve Thousand Five Hundred and One Rupees only");
    assert.equal(amountInWords(8030), "Eight Thousand and Thirty Rupees only");
    assert.equal(amountInWords(100000), "One Lakh Rupees only");
    assert.equal(amountInWords(12345678), "One Crore Twenty Three Lakh Forty Five Thousand Six Hundred and Seventy Eight Rupees only");
    assert.equal(amountInWords(45), "Forty Five Rupees only");
    assert.equal(amountInWords(0), "Zero Rupees only");
    assert.equal(amountInWords(10.5), "Ten Rupees and Fifty Paise only");
  });

  it("Financial year (April-March, IST)", () => {
    assert.equal(financialYear(new Date("2025-06-25T10:00:00+05:30")), "25-26");
    assert.equal(financialYear(new Date("2026-03-31T23:00:00+05:30")), "25-26");
    assert.equal(financialYear(new Date("2026-04-01T00:30:00+05:30")), "26-27", "IST midnight rolls the year");
    assert.equal(financialYear(new Date("2026-03-31T19:00:00Z")), "26-27", "19:00Z is already 1 Apr 00:30 IST");
    assert.equal(financialYear(new Date("2099-12-31T10:00:00Z")), "99-00");

    assert.equal(formatInvoiceNumber("SI/INV", "25-26", 4, 2), "SI/INV/25-26/04");
    assert.equal(formatInvoiceNumber("SI/INV", "25-26", 123, 2), "SI/INV/25-26/123");
  });

  it("Place of supply from a free-text state", () => {
    assert.equal(placeOfSupplyFor("Gujarat"), "24-Gujarat");
    assert.equal(placeOfSupplyFor("  gujarat "), "24-Gujarat");
    assert.equal(placeOfSupplyFor("24"), "24-Gujarat");
    assert.equal(placeOfSupplyFor("Maharashtra"), "27-Maharashtra");
    assert.equal(placeOfSupplyFor("Atlantis"), null);
    assert.equal(placeOfSupplyFor(""), null);
  });

  it("An exact discount amount wins over the percentage", () => {
    const { lines, totals } = computeInvoice({
      ...base,
      gstEnabled: true,
      items: [
        { name: "A", quantity: 3, unitPrice: 333.33, discountPct: 50, discountAmount: 69.99, gstRate: 12 },
        { name: "B", quantity: 1, unitPrice: 100, discountAmount: 500 },
      ],
    });
    assert.equal(lines[0].discountAmount, 69.99);
    assert.equal(lines[0].taxable, 930);
    assert.equal(lines[0].discountPct, 7, "printed percentage derived from the amount");
    assert.equal(lines[1].discountAmount, 100, "never more than the line value");
    assert.equal(lines[1].taxable, 0);
    assert.equal(totals.discountTotal, 169.99);
  });

  it("Copies setting: canonical order, de-duplicated, never empty", () => {
    assert.deepEqual(normalizeCopies(["triplicate", "original", "original"]), ["original", "triplicate"]);
    assert.deepEqual(normalizeCopies([]), ["original"]);
    assert.deepEqual(normalizeCopies(undefined), ["original"]);
    assert.deepEqual(normalizeCopies(["bogus"]), ["original"]);
  });
});
