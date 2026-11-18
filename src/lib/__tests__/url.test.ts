import { describe, expect, it } from "vitest";
import { safeHttpUrl } from "../url";

describe("safeHttpUrl", () => {
  it("keeps http(s) links", () => {
    expect(safeHttpUrl(" https://www.bluedart.com/track?awb=1 ")).toBe("https://www.bluedart.com/track?awb=1");
    expect(safeHttpUrl("http://x.in")).toBe("http://x.in/");
  });

  it("rejects script, data and relative links", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("JavaScript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>")).toBeNull();
    expect(safeHttpUrl("/dashboard")).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });
});
