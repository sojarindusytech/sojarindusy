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

  it("prints only a receipt's own note, never the invoice terms", () => {
    assert.equal(documentTerms(base, "receipt"), "");
    assert.equal(documentTerms({ ...base, receipt_terms: "Subject to realisation of cheque." }, "receipt"), "Subject to realisation of cheque.");
  });
});

describe("termsParagraphs", () => {
  it("splits on blank lines and drops empties", () => {
    assert.deepEqual(termsParagraphs("A line\nsecond line\n\n\n  Next  \n\n"), ["A line\nsecond line", "Next"]);
    assert.deepEqual(termsParagraphs(""), []);
  });
});
