import { describe, expect, it } from "vitest";
import { passwordValidation, step1Schema, step2Schema } from "../validations/auth";
import { csvCell } from "../csv";

const step1 = {
  title: "Mr", first_name: "Asha", last_name: "Patel", department: "Purchase", designation: "Manager",
  mobile: "9820701219", email: "a@b.in", password: "Str0ng!pass", confirm_password: "Str0ng!pass",
};
const step2 = { company_name: "Acme", company_address: "Plot 7, Vapi", city: "Vapi", state: "Gujarat", pincode: "396191" };

describe("password", () => {
  it("accepts any symbol or space as the special character", () => {
    for (const p of ["Abcdefg1~", "Abcdefg1`", "Abcdefg1 x"]) expect(passwordValidation.safeParse(p).success).toBe(true);
  });
  it("rejects more than 72 bytes (bcrypt ignores the rest)", () => {
    expect(passwordValidation.safeParse("Aa1!" + "x".repeat(68)).success).toBe(true);
    expect(passwordValidation.safeParse("Aa1!" + "x".repeat(69)).success).toBe(false);
    // 30 three-byte characters = 90 bytes though only 34 characters
    expect(passwordValidation.safeParse("Aa1!" + "€".repeat(30)).success).toBe(false);
  });
});

describe("signup fields", () => {
  it("accepts a valid step 1 and step 2", () => {
    expect(step1Schema.safeParse(step1).success).toBe(true);
    expect(step2Schema.safeParse(step2).success).toBe(true);
  });
  it("mobile is exactly 10 digits", () => {
    expect(step1Schema.safeParse({ ...step1, mobile: "982070121" }).success).toBe(false);
    expect(step1Schema.safeParse({ ...step1, mobile: "982070121955555" }).success).toBe(false);
  });
  it("limits text lengths", () => {
    expect(step1Schema.safeParse({ ...step1, first_name: "x".repeat(61) }).success).toBe(false);
    expect(step2Schema.safeParse({ ...step2, company_address: "x".repeat(301) }).success).toBe(false);
    expect(step1Schema.safeParse({ ...step1, landline: "abc" }).success).toBe(false);
  });
  it("state must be a real Indian state", () => {
    expect(step2Schema.safeParse({ ...step2, state: "Narnia" }).success).toBe(false);
  });
  it("GSTIN is stored upper-case", () => {
    const r = step2Schema.safeParse({ ...step2, gstin: "27aaaaa0000a1z5" });
    expect(r.success && r.data.gstin).toBe("27AAAAA0000A1Z5");
  });
});

describe("csvCell", () => {
  it("neutralises spreadsheet formulas and doubles quotes", () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell("+1")).toBe(`"'+1"`);
    expect(csvCell("-2")).toBe(`"'-2"`);
    expect(csvCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
    expect(csvCell('Acme "Tools", Ltd')).toBe(`"Acme ""Tools"", Ltd"`);
    expect(csvCell(null)).toBe(`""`);
  });
});
