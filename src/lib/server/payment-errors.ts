import "server-only";
import type { DbAppError } from "@/lib/server/db-error";

const inr = (n: unknown) => `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** User-facing text for the errors raised by record_payment / cancel_payment and the invoice guards. */
export function paymentErrorMessage(error: DbAppError): string {
  const d = error.detail;
  switch (error.code) {
    case "OVER_ALLOCATED":
      return d.debit_note_number
        ? `Debit note ${String(d.debit_note_number)} has only ${inr(d.balance)} outstanding, but ${inr(d.applied)} was applied to it.`
        : `Invoice ${String(d.invoice_number ?? "")} has only ${inr(d.balance)} outstanding, but ${inr(d.applied)} was applied to it.`;
    case "ALLOCATION_MISMATCH":
      return `The allocations total ${inr(d.allocated)} but the amount received is ${inr(d.amount)}.`;
    case "INVOICE_NOT_PAYABLE":
      return `Invoice ${String(d.invoice_number ?? "")} cannot receive this payment: it is cancelled or belongs to another customer.`;
    case "INVOICE_NOT_FOUND":
      return "One of the invoices could not be found. Refresh and try again.";
    case "DEBIT_NOTE_NOT_PAYABLE":
      return `Debit note ${String(d.debit_note_number ?? "")} cannot receive this payment: it is cancelled or belongs to another customer.`;
    case "DEBIT_NOTE_NOT_FOUND":
      return "One of the debit notes could not be found. Refresh and try again.";
    case "DUPLICATE_RECEIPT_NUMBER":
      return "That receipt number already exists.";
    case "PAYMENT_DATE_INVALID":
      return "The payment date cannot be in the future.";
    case "PAYER_REQUIRED":
      return "Enter the payer's name for a walk-in payment.";
    case "CUSTOMER_NOT_FOUND":
      return "Customer not found.";
    case "REASON_REQUIRED":
      return "Enter a reason (at least 3 characters).";
    case "PAYMENT_NOT_FOUND":
      return "Receipt not found.";
    case "ADMIN_REQUIRED":
      return "Administrator access required.";
    case "INVOICE_HAS_PAYMENTS":
      return `This invoice has ${inr(d.paid)} received against it. Cancel the receipt(s) first, or issue a credit note.`;
    case "TOTAL_BELOW_PAID":
      return `The invoice total (${inr(d.total)}) cannot be lower than the ${inr(d.paid)} already received.`;
    default:
      return "Could not save the payment. Please check the details and try again.";
  }
}
