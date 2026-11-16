import { describe, expect, it } from "vitest";
import { diffChanges } from "../audit";

describe("diffChanges", () => {
  it("keeps only changed fields, with from / to", () => {
    expect(diffChanges({ a: 1, b: "x", c: null }, { a: 2, b: "x", c: null })).toEqual({ a: { from: 1, to: 2 } });
  });

  it("returns null when nothing changed and ignores timestamps", () => {
    expect(diffChanges({ a: 1, updated_at: "t1" }, { a: 1, updated_at: "t2" })).toBeNull();
  });

  it("treats undefined and null as equal, and compares objects by value", () => {
    expect(diffChanges({ a: undefined, o: { x: 1 } }, { a: null, o: { x: 1 } })).toBeNull();
    expect(diffChanges({ o: { x: 1 } }, { o: { x: 2 } })).toEqual({ o: { from: { x: 1 }, to: { x: 2 } } });
  });

  it("limits to the given fields and masks secrets", () => {
    expect(diffChanges({ a: 1, z: 1 }, { a: 2, z: 2 }, ["a"])).toEqual({ a: { from: 1, to: 2 } });
    expect(diffChanges({ account_no: "111" }, { account_no: "222" })).toEqual({ account_no: { from: "••••", to: "••••" } });
  });
});
