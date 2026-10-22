import { describe, expect, it } from "vitest";
import {
  accountTotals,
  balanceSheet,
  drCr,
  drCrText,
  financialYearRange,
  groupByEntry,
  ledgerRangePresets,
  partyName,
  profitAndLoss,
  suggestAccountCode,
  tallyMastersXml,
  tallyVouchersXml,
  trialBalance,
  uniqueTallyNames,
  xmlEscape,
  type BalanceRow,
  type ReportLine,
} from "../ledger";
import { journalSchema, ledgerAccountSchema, supplierPaymentSchema } from "../validations/ledger";

const acc = (id: string, code: string, type: "asset" | "liability" | "equity" | "income" | "expense", kind: "general" | "receivable" | "payable" | "bank" | "cash" = "general") =>
  ({ id, code, name: id, type, kind });

const accounts = [
  acc("recv", "1100", "asset", "receivable"),
  acc("bank", "1210", "asset", "bank"),
  acc("pay", "2000", "liability", "payable"),
  acc("cgst", "2100", "liability"),
  acc("sgst", "2110", "liability"),
  acc("obal", "3900", "equity"),
  acc("sales", "4100", "income"),
  acc("charges", "5200", "expense"),
];

// Opening: customer owed 5,000 (against Opening Balance Adjustment).
// In range: invoice 1,180 (1,000 + 90 + 90), receipt 700 into the bank, bank charges 20, paid manufacturer 300.
const rows: BalanceRow[] = [
  { account_id: "recv", party_id: "c1", opening: 5000, debit: 1180, credit: 700 },
  { account_id: "obal", party_id: null, opening: -5000, debit: 0, credit: 0 },
  { account_id: "sales", party_id: null, opening: 0, debit: 0, credit: 1000 },
  { account_id: "cgst", party_id: null, opening: 0, debit: 0, credit: 90 },
  { account_id: "sgst", party_id: null, opening: 0, debit: 0, credit: 90 },
  { account_id: "bank", party_id: null, opening: 0, debit: 700, credit: 320 },
  { account_id: "charges", party_id: null, opening: 0, debit: 20, credit: 0 },
  { account_id: "pay", party_id: "m1", opening: 0, debit: 300, credit: 0 },
];

describe("ledger reports", () => {
  const totals = accountTotals(accounts, rows);

  it("totals each account and drops accounts with nothing on them", () => {
    expect(totals.map((t) => t.account.id)).toEqual(["recv", "bank", "pay", "cgst", "sgst", "obal", "sales", "charges"]);
    expect(totals.find((t) => t.account.id === "recv")).toMatchObject({ opening: 5000, debit: 1180, credit: 700, closing: 5480 });
  });

  it("trial balance debits equal credits", () => {
    const tb = trialBalance(totals);
    expect(tb.debit).toBe(tb.credit);
    expect(tb.debit).toBe(5480 + 380 + 300 + 20);
  });

  it("profit and loss uses movements in the range", () => {
    const pl = profitAndLoss(totals);
    expect(pl.totalIncome).toBe(1000);
    expect(pl.totalExpense).toBe(20);
    expect(pl.net).toBe(980);
  });

  it("balance sheet balances with profit to date under equity", () => {
    const bs = balanceSheet(totals);
    expect(bs.profit).toBe(980);
    expect(bs.totalAssets).toBe(5480 + 380); // receivables and bank
    // The advance paid to the manufacturer stays on its own account, a liability shown as a negative.
    expect(bs.liabilities.find((r) => r.account.id === "pay")?.amount).toBe(-300);
    expect(bs.totalAssets).toBe(bs.totalLiabilities);
  });
});

describe("formatting and dates", () => {
  it("shows balances with their side", () => {
    expect(drCr(1180)).toEqual({ amount: "1,180.00", side: "Dr" });
    expect(drCr(-250.5)).toEqual({ amount: "250.50", side: "Cr" });
    expect(drCrText(0)).toBe("0.00");
    expect(drCrText(-1234567.891)).toBe("12,34,567.89 Cr");
  });

  it("knows the April-to-March financial year", () => {
    expect(financialYearRange("2026-10-21")).toEqual({ from: "2026-04-01", to: "2027-03-31", label: "FY 2026-27" });
    expect(financialYearRange("2027-02-10")).toEqual({ from: "2026-04-01", to: "2027-03-31", label: "FY 2026-27" });
    expect(financialYearRange("2026-04-01").from).toBe("2026-04-01");
  });

  it("offers this and last year and month as presets", () => {
    const p = ledgerRangePresets("2026-10-21");
    expect(p.find((x) => x.key === "fy")).toMatchObject({ from: "2026-04-01", to: "2026-10-21" });
    expect(p.find((x) => x.key === "last_fy")).toMatchObject({ from: "2025-04-01", to: "2026-03-31" });
    expect(p.find((x) => x.key === "last_month")).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("suggests a free account code", () => {
    expect(suggestAccountCode(["1200", "1210"], "asset", "bank")).toBe("1211");
    expect(suggestAccountCode(["5400"], "expense", "general")).toBe("5401");
  });

  it("names a party from its profile", () => {
    expect(partyName({ company_name: "-", first_name: "Asha", last_name: "Rao" })).toBe("Asha Rao");
    expect(partyName({ company_name: " Sojar Tools " })).toBe("Sojar Tools");
    expect(partyName({ email: "x@y.in" })).toBe("x@y.in");
  });
});

describe("Tally export", () => {
  it("escapes XML and drops control characters", () => {
    expect(xmlEscape(`A & B <"C">'\u0001`)).toBe("A &amp; B &lt;&quot;C&quot;&gt;&apos;");
  });

  it("keeps ledger names unique", () => {
    expect(uniqueTallyNames([{ preferred: "Acme", suffix: "a@x" }, { preferred: "acme", suffix: "b@x" }, { preferred: "Sales", suffix: "c@x" }], ["Sales"]))
      .toEqual(["Acme", "acme (b@x)", "Sales (c@x)"]);
  });

  it("writes a sales voucher with debit negative, credit positive and a new bill reference", () => {
    const xml = tallyVouchersXml([{
      remoteId: "sojar-invoice-1", type: "invoice", date: "2026-10-03", number: "SI/INV/26-27/04", narration: "Sales invoice",
      lines: [
        { ledger: "Acme Pvt Ltd", amount: 1180, isParty: true, billRef: "SI/INV/26-27/04", billType: "new" },
        { ledger: "Sales", amount: -1000, isParty: false },
        { ledger: "Output CGST", amount: -90, isParty: false },
        { ledger: "Output SGST", amount: -90, isParty: false },
      ],
    }], "Sojar Indusy");
    expect(xml).toContain("<SVCURRENTCOMPANY>Sojar Indusy</SVCURRENTCOMPANY>");
    expect(xml).toContain('<VOUCHER REMOTEID="sojar-invoice-1" VCHTYPE="Sales" ACTION="Create"');
    expect(xml).toContain("<DATE>20261003</DATE>");
    expect(xml).toContain("<PARTYLEDGERNAME>Acme Pvt Ltd</PARTYLEDGERNAME>");
    expect(xml).toContain("<LEDGERNAME>Acme Pvt Ltd</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><ISPARTYLEDGER>Yes</ISPARTYLEDGER><AMOUNT>-1180.00</AMOUNT>");
    expect(xml).toContain("<BILLALLOCATIONS.LIST><NAME>SI/INV/26-27/04</NAME><BILLTYPE>New Ref</BILLTYPE><AMOUNT>-1180.00</AMOUNT></BILLALLOCATIONS.LIST>");
    expect(xml).toContain("<LEDGERNAME>Sales</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><ISPARTYLEDGER>No</ISPARTYLEDGER><AMOUNT>1000.00</AMOUNT>");
  });

  it("merges a receipt's party lines into one entry with a bill allocation per invoice", () => {
    const xml = tallyVouchersXml([{
      remoteId: "sojar-receipt-1", type: "receipt", date: "2026-10-08", number: "SI/RCPT/26-27/02", narration: null,
      lines: [
        { ledger: "HDFC Bank", amount: 1500, isParty: false },
        { ledger: "Acme Pvt Ltd", amount: -1000, isParty: true, billRef: "SI/INV/26-27/04", billType: "against" },
        { ledger: "Acme Pvt Ltd", amount: -500, isParty: true, billRef: null, billType: "advance" },
      ],
    }]);
    expect(xml).toContain('VCHTYPE="Receipt"');
    expect(xml.match(/<LEDGERNAME>Acme Pvt Ltd<\/LEDGERNAME>/g)).toHaveLength(1);
    expect(xml).toContain("<AMOUNT>1500.00</AMOUNT><BILLALLOCATIONS.LIST><NAME>SI/INV/26-27/04</NAME><BILLTYPE>Agst Ref</BILLTYPE><AMOUNT>1000.00</AMOUNT>");
    expect(xml).toContain("<BILLALLOCATIONS.LIST><NAME>SI/RCPT/26-27/02</NAME><BILLTYPE>Advance</BILLTYPE><AMOUNT>500.00</AMOUNT></BILLALLOCATIONS.LIST>");
    expect(xml).not.toContain("<SVCURRENTCOMPANY>");
  });

  it("writes ledger masters with groups, GSTIN and GST duty heads", () => {
    const xml = tallyMastersXml([
      { name: "Acme Pvt Ltd", parent: "Sundry Debtors", isParty: true, gstin: "24ABCDE1234F1Z5", state: "Gujarat" },
      { name: "Output CGST", parent: "Duties & Taxes", gstDutyHead: "Central Tax" },
    ]);
    expect(xml).toContain("<REPORTNAME>All Masters</REPORTNAME>");
    expect(xml).toContain('<LEDGER NAME="Acme Pvt Ltd" ACTION="Create">');
    expect(xml).toContain("<PARENT>Sundry Debtors</PARENT><ISBILLWISEON>Yes</ISBILLWISEON>");
    expect(xml).toContain("<PARTYGSTIN>24ABCDE1234F1Z5</PARTYGSTIN>");
    expect(xml).toContain("<PARENT>Duties &amp; Taxes</PARENT><TAXTYPE>GST</TAXTYPE><GSTDUTYHEAD>Central Tax</GSTDUTYHEAD>");
  });
});

describe("groupByEntry", () => {
  it("groups report lines into vouchers in order", () => {
    const line = (entry: string, no: number): ReportLine => ({
      line_id: `${entry}-${no}`, entry_id: entry, entry_seq: 1, line_no: no, entry_date: "2026-10-01", voucher_type: "journal",
      voucher_number: entry, source_id: null, is_reversal: false, reversed: false, narration: null, line_narration: null,
      account_id: "a", account_code: "1", account_name: "A", party_id: null, debit: 1, credit: 0, bill_ref: null, bill_type: null, balance: 0,
    });
    const g = groupByEntry([line("JV1", 1), line("JV1", 2), line("JV2", 1)]);
    expect(g.map((e) => [e.voucher_number, e.lines.length])).toEqual([["JV1", 2], ["JV2", 1]]);
  });
});

describe("form rules", () => {
  const uuid = "11111111-2222-4333-8444-555555555555";
  const uuid2 = "66666666-7777-4888-9999-000000000000";

  it("a journal balances, has two lines and a narration; an opening balance does not need to balance", () => {
    const base = { requestId: uuid, kind: "journal" as const, entryDate: "2026-10-01", narration: "Bank charges" };
    expect(journalSchema.safeParse({ ...base, lines: [{ accountId: uuid, debit: 10, credit: 0 }, { accountId: uuid2, debit: 0, credit: 10 }] }).success).toBe(true);
    expect(journalSchema.safeParse({ ...base, lines: [{ accountId: uuid, debit: 10, credit: 0 }, { accountId: uuid2, debit: 0, credit: 9 }] }).success).toBe(false);
    expect(journalSchema.safeParse({ ...base, lines: [{ accountId: uuid, debit: 10, credit: 10 }, { accountId: uuid2, debit: 0, credit: 0 }] }).success).toBe(false);
    expect(journalSchema.safeParse({ ...base, narration: "", lines: [{ accountId: uuid, debit: 10, credit: 0 }, { accountId: uuid2, debit: 0, credit: 10 }] }).success).toBe(false);
    expect(journalSchema.safeParse({ ...base, kind: "opening", narration: null, lines: [{ accountId: uuid, partyId: uuid2, debit: 5000, credit: 0, billRef: "OLD/1" }] }).success).toBe(true);
  });

  it("a payment made needs a manufacturer, an amount and the account it was paid from", () => {
    const ok = { requestId: uuid, manufacturerId: uuid2, paymentDate: "2026-10-01", amount: 2500.5, mode: "upi", accountId: uuid };
    expect(supplierPaymentSchema.safeParse(ok).success).toBe(true);
    expect(supplierPaymentSchema.safeParse({ ...ok, amount: 0 }).success).toBe(false);
    expect(supplierPaymentSchema.safeParse({ ...ok, mode: "barter" }).success).toBe(false);
    expect(supplierPaymentSchema.safeParse({ ...ok, accountId: "" }).success).toBe(false);
  });

  it("an account has a 3-6 digit code, and bank accounts are assets with a valid IFSC", () => {
    const bank = { code: "1211", name: "ICICI Current", type: "asset" as const, kind: "bank" as const, tallyGroup: "Bank Accounts", ifsc: "icic0001234" };
    const parsed = ledgerAccountSchema.safeParse(bank);
    expect(parsed.success && parsed.data.ifsc).toBe("ICIC0001234");
    expect(ledgerAccountSchema.safeParse({ ...bank, ifsc: "BAD" }).success).toBe(false);
    expect(ledgerAccountSchema.safeParse({ ...bank, type: "expense" }).success).toBe(false);
    expect(ledgerAccountSchema.safeParse({ ...bank, code: "12" }).success).toBe(false);
    expect(ledgerAccountSchema.safeParse({ code: "5401", name: "Rent", type: "expense", kind: "general", tallyGroup: "Indirect Expenses" }).success).toBe(true);
  });
});
