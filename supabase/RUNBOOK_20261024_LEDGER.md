# Release: General Ledger, Party Ledger, Payments Made, Tally export

One SQL file. Run it in the Supabase SQL Editor **before** deploying the app, after every earlier
migration (the last one is `20261023_debit_note_terms_and_payments.sql`).

| # | File | What it does |
|---|------|--------------|
| 1 | `migrations/20261024_ledger.sql` | Adds the books: chart of accounts, ledger entries and lines, Payments Made, journal vouchers and opening balances, the "Books locked up to" date, and the reports. Then posts every existing invoice, credit note, debit note and receipt into the books once. |

The file is one transaction: if anything fails, nothing is changed. Running it a second time does not
post anything twice.

## How it works (short)

- Every invoice, credit note, debit note, receipt and payment made writes a balanced entry
  (debit = credit) **inside the database, in the same transaction** as the document. Nothing in the
  app can skip it.
- Ledger rows are never edited or deleted. Cancelling or editing a document adds a reversal entry on
  the same date, so the history stays (audit trail, Companies (Accounts) Rules 3(1)).
- Credit notes credit the customer in the books only. Payments Received balances are unchanged.
- Party Ledger = the entries on Trade Receivables (customers) and Trade Payables (manufacturers).
  General Ledger = all entries by account. Both read the same rows, so they always agree.

| Document | Debit | Credit |
|----------|-------|--------|
| Invoice | Trade Receivables (customer) | Sales, Output CGST / SGST / IGST, Round Off |
| Credit note (GST) | Sales Returns, Output GST | Trade Receivables (customer) |
| Credit note (commercial) | Discount Allowed | Trade Receivables (customer) |
| Debit note | Trade Receivables (customer) | Sales, Output GST |
| Receipt | Bank / Cash ("Deposited in") | Trade Receivables (customer), one line per invoice / debit note / advance |
| Payment made | Trade Payables (manufacturer) | Bank / Cash ("Paid from") |
| Opening balance | Party / account | Opening Balance Adjustment (automatic) |
| Journal | any | any (must balance) |

## After running

1. **Sales Settings → Bank & Cash Accounts.** The invoice bank details became the default bank
   account. Add every other bank account and cash book money goes into. Receipts and payments made
   pick from this list. (Old receipts went to the default bank account, or Cash in Hand when paid in
   cash, unless "Deposited in" matched an account name exactly.)
2. **Sales Settings → Document Numbering.** Two new series: Payment Made (`SI/PAY`) and Journal
   Voucher (`SI/JV`). Change the prefix if needed.
3. **Past balances.** Party Ledger → "Add opening balance": what each customer owed (debit) and what
   was owed to each manufacturer (credit) on the go-live date. Optional: the old bill number.
4. **Tally names.** General Ledger → Accounts → edit each account's "Name in Tally" to match the
   accountant's ledger names. Then General Ledger → Tally Export: import Masters first, then Vouchers.
   Try the first import on a backup copy of the Tally company.
5. **Books locked up to** (Sales Settings → Accounts & Ledger): set it after a month or year is closed
   with the accountant. Nothing on or before that date can then be added, edited or cancelled.

## Check it worked (SQL Editor)

```sql
-- 1. The books balance: must return 0.
SELECT coalesce(sum(debit - credit), 0) AS difference FROM public.ledger_lines;

-- 2. No entry is unbalanced: must return no rows.
SELECT entry_id FROM public.ledger_lines GROUP BY entry_id HAVING sum(debit) <> sum(credit);

-- 3. Every issued invoice has one live entry: must return no rows.
SELECT i.invoice_number FROM public.invoices i
 WHERE i.status = 'issued' AND i.total_amount > 0
   AND NOT EXISTS (SELECT 1 FROM public.ledger_entries e
                    WHERE e.voucher_type = 'invoice' AND e.source_id = i.id
                      AND NOT e.is_reversal AND e.reversed_by IS NULL);

-- 4. What was posted.
SELECT voucher_type, count(*) FROM public.ledger_entries GROUP BY 1 ORDER BY 1;
```

Then in the app: General Ledger → Trial Balance shows "Debits equal credits", and a customer's
Party Ledger closing balance = their invoices + debit notes − receipts − credit notes.

## Screens

- **Party Ledger** (Ledger menu): every customer and manufacturer with opening, debit, credit,
  closing and overdue; click one for the statement with running balance, pending bills, ageing and a
  PDF.
- **General Ledger**: Accounts, Account Ledger, Day Book, Trial Balance, Profit & Loss, Balance Sheet,
  Journals, Tally Export.
- **Payments Made** (Sales menu): record and cancel payments to manufacturers.
- **Customer dashboard → Account Statement**: the customer's own statement and PDF.

## Not included

- Purchase bills / expenses as documents. A manufacturer's bill can be entered as a journal
  (Purchases debit, Trade Payables credit to the manufacturer); otherwise payments made show as paid in
  advance.
- TDS deducted by customers on receipts: enter as a journal (TDS Receivable debit, customer credit).
- Emailing / WhatsApp of statements: download the PDF and send it.

## Rolling back

Roll back the **app** only. Keep the tables once documents have been posted: they are the books.
