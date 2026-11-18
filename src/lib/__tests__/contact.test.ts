import { describe, expect, it } from "vitest";
import { normalizeMobile, validateInquiry } from "../contact";

const ok = { fullName: "Asha Patel", email: "Asha@Example.com", message: "Need 6mm end mills, 50 pcs.", privacyAccepted: true };

describe("validateInquiry", () => {
  it("requires explicit privacy consent (missing is not consent)", () => {
    expect(validateInquiry({ ...ok, privacyAccepted: undefined })).toHaveProperty("error");
    expect(validateInquiry({ ...ok, privacyAccepted: false })).toHaveProperty("error");
  });

  it("accepts names in any script and lower-cases email", () => {
    for (const fullName of ["José Núñez", "राहुल शर्मा", "O'Neil-Smith Jr."]) {
      expect(validateInquiry({ ...ok, fullName })).toHaveProperty("data");
    }
    const r = validateInquiry(ok);
    expect("data" in r && r.data.email).toBe("asha@example.com");
  });

  it("rejects names with digits or symbols, short/long messages", () => {
    expect(validateInquiry({ ...ok, fullName: "Bot123" })).toHaveProperty("error");
    expect(validateInquiry({ ...ok, fullName: "<script>" })).toHaveProperty("error");
    expect(validateInquiry({ ...ok, message: "short" })).toHaveProperty("error");
    expect(validateInquiry({ ...ok, message: "x".repeat(2001) })).toHaveProperty("error");
  });
});

describe("normalizeMobile", () => {
  it("stores every Indian format the same way", () => {
    for (const raw of ["9876543210", "919876543210", "+91 98765-43210", "(+91) 98765 43210"]) {
      expect(normalizeMobile(raw)).toBe("+919876543210");
    }
  });

  it("keeps international numbers with a + and rejects junk", () => {
    expect(normalizeMobile("4915112345678")).toBe("+4915112345678");
    expect(normalizeMobile("12345")).toBeNull();
    expect(normalizeMobile("abc")).toBeNull();
  });
});
