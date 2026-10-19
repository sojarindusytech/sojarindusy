import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { documentTerms, termsParagraphs } from "../document-terms";

describe("documentTerms", () => {
  const base = { terms: "Invoice terms", quote_terms: null, receipt_terms: null };

  it("uses the invoice terms for invoices", () => {
    assert.equal(documentTerms({ ...base, quote_terms: "Quote terms" }, "invoice"), "Invoice terms");
  });

  it("uses the quotation terms, falling back to the invoice terms while blank", () => {
    assert.equal(documentTerms({ ...base, quote_terms: "Quote terms" }, "quote"), "Quote terms");
    assert.equal(documentTerms(base, "quote"), "Invoice terms");
    assert.equal(documentTerms({ ...base, quote_terms: "   " }, "quote"), "Invoice terms");
  });

  it("uses only credit note terms and preserves old snapshots without that field", () => {
    assert.equal(documentTerms({ ...base, credit_note_terms: "  Credit terms  " }, "credit_note"), "Credit terms");
    assert.equal(documentTerms(base, "credit_note"), "");
    assert.equal(documentTerms({ ...base, credit_note_terms: null }, "credit_note"), "");
    assert.equal(documentTerms({ ...base, credit_note_terms: "   " }, "credit_note"), "");
  });

  it("uses the debit note terms, falling back to the invoice terms while blank", () => {
    assert.equal(documentTerms({ ...base, debit_note_terms: "Payable within 15 days." }, "debit_note"), "Payable within 15 days.");
    assert.equal(documentTerms(base, "debit_note"), "Invoice terms");
    assert.equal(documentTerms({ ...base, debit_note_terms: "  " }, "debit_note"), "Invoice terms");
    // Quotation terms never leak onto a debit note.
    assert.equal(documentTerms({ ...base, quote_terms: "Quote terms" }, "debit_note"), "Invoice terms");
  });

  it("prints only a receipt's own note, never the invoice terms", () => {
    assert.equal(documentTerms(base, "receipt"), "");
    assert.equal(documentTerms({ ...base, receipt_terms: "Subject to realisation of cheque." }, "receipt"), "Subject to realisation of cheque.");
  });

  it("keeps credit and debit terms independent when both are configured", () => {
    const settings = { ...base, credit_note_terms: "Credit terms", debit_note_terms: "Debit terms" };
    assert.equal(documentTerms(settings, "credit_note"), "Credit terms");
    assert.equal(documentTerms(settings, "debit_note"), "Debit terms");
    assert.equal(documentTerms({ ...settings, credit_note_terms: "" }, "credit_note"), "");
    assert.equal(documentTerms({ ...settings, debit_note_terms: null }, "debit_note"), "Invoice terms");
  });
});

describe("termsParagraphs", () => {
  it("splits on blank lines and drops empties", () => {
    assert.deepEqual(termsParagraphs("A line\nsecond line\n\n\n  Next  \n\n"), ["A line\nsecond line", "Next"]);
    assert.deepEqual(termsParagraphs(""), []);
  });
});
