/**
 * Contact-form rules shared by the storefront form and the server action, so both
 * accept and reject exactly the same input.
 */

/** Letters in any script (José, राहुल), spaces and . ' - */
export const NAME_RE = /^[\p{L}\p{M}\s.'-]+$/u;
export const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const CONTACT_LIMITS = { nameMin: 2, nameMax: 100, emailMax: 254, messageMin: 10, messageMax: 2000 } as const;

/** Submissions allowed per email address per hour. */
export const CONTACT_RATE_LIMIT = { max: 3, windowMinutes: 60 } as const;

/**
 * One stored format: +91XXXXXXXXXX for Indian numbers (10 digits, or 91/+91 prefixed),
 * other international numbers keep their digits with a leading +. null = invalid.
 */
export function normalizeMobile(raw: string): string | null {
  const s = raw.trim().replace(/[\s()-]/g, "");
  const indian = /^(?:\+?91)?([6-9]\d{9})$/.exec(s);
  if (indian) return `+91${indian[1]}`;
  if (/^\+?\d{10,14}$/.test(s)) return s.startsWith("+") ? s : `+${s}`;
  return null;
}

export interface InquiryInput {
  fullName: string;
  email: string;
  mobile?: string;
  message: string;
  privacyAccepted?: boolean;
}

export interface CleanInquiry {
  full_name: string;
  email: string;
  mobile: string | null;
  message: string;
}

export function validateInquiry(input: InquiryInput): { data: CleanInquiry } | { error: string } {
  if (input.privacyAccepted !== true) {
    return { error: "You must agree to our Privacy Policy to submit your message." };
  }

  const name = typeof input.fullName === "string" ? input.fullName.trim() : "";
  if (!name) return { error: "Please enter your full name." };
  if (name.length < CONTACT_LIMITS.nameMin) return { error: "Name must be at least 2 characters long." };
  if (name.length > CONTACT_LIMITS.nameMax) return { error: "Name must not exceed 100 characters." };
  if (!NAME_RE.test(name)) return { error: "Name should only contain letters and standard characters." };

  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!email) return { error: "Please enter your email address." };
  if (!EMAIL_RE.test(email) || email.length > CONTACT_LIMITS.emailMax) {
    return { error: "Please provide a valid email address (e.g. name@example.com)." };
  }

  let mobile: string | null = null;
  if (typeof input.mobile === "string" && input.mobile.trim()) {
    mobile = normalizeMobile(input.mobile);
    if (!mobile) return { error: "Please enter a valid 10-digit mobile number." };
  }

  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!message) return { error: "Please enter your message or requirements." };
  if (message.length < CONTACT_LIMITS.messageMin) {
    return { error: "Message must be at least 10 characters long so we can assist you better." };
  }
  if (message.length > CONTACT_LIMITS.messageMax) return { error: "Message cannot exceed 2000 characters." };

  return { data: { full_name: name, email, mobile, message } };
}
