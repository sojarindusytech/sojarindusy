import { describe, expect, it } from "vitest";
import { accountHome } from "../account-home";

describe("accountHome", () => {
  it.each([
    ["admin", "approved", "/admin/dashboard"],
    ["admin", "pending", "/admin/dashboard"],
    ["platform_owner", "rejected", "/admin/dashboard"],
    ["manufacturer", "pending", "/manufacturer"],
    ["manufacturer", "rejected", "/manufacturer"],
    ["customer", "approved", "/dashboard"],
    ["customer", "pending", "/pending-approval"],
    ["customer", "rejected", "/application-rejected"],
  ])("%s / %s -> %s", (role, status, home) => {
    expect(accountHome(role, status)).toBe(home);
  });

  it("denies by default when role or status is missing or unknown", () => {
    expect(accountHome(undefined, undefined)).toBe("/pending-approval");
    expect(accountHome(null, null)).toBe("/pending-approval");
    expect(accountHome("customer", "APPROVED")).toBe("/pending-approval");
    expect(accountHome("customer", "")).toBe("/pending-approval");
  });
});
