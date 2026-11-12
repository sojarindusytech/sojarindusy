import { describe, expect, it } from "vitest";
import { buildCsvTable, clampCsvRange, defaultCsvRange, guessColumnMapping, parseCsvGrid } from "../csv-grid";

const file = ["Sojar price list", "", "CODE,D,Price,Stock", "A1,3,100,5", "A2,4,200,6", "", "Total,,300,11"].join("\n");

describe("parseCsvGrid", () => {
  it("keeps blank lines so row numbers match the file", () => {
    const grid = parseCsvGrid(file);
    expect(grid).toHaveLength(7);
    expect(grid[1]).toEqual([]);
    expect(grid[2]).toEqual(["CODE", "D", "Price", "Stock"]);
  });

  it("reads quotes, a BOM, CRLF and trailing blank lines", () => {
    const grid = parseCsvGrid('﻿"A, B",C\r\n"say ""hi""",2\r\n\r\n');
    expect(grid).toEqual([["A, B", "C"], ['say "hi"', "2"]]);
  });

  it("finds tab and semicolon files even with a title line above the heading", () => {
    expect(parseCsvGrid("Title\nCODE\tD\nA1\t3")[1]).toEqual(["CODE", "D"]);
    expect(parseCsvGrid("Title\nCODE;D\nA1;3")[1]).toEqual(["CODE", "D"]);
  });

  it("returns nothing for an empty file", () => {
    expect(parseCsvGrid("")).toEqual([]);
    expect(parseCsvGrid("\n\n")).toEqual([]);
  });
});

describe("buildCsvTable", () => {
  const grid = parseCsvGrid(file);

  it("defaults to the first non-empty line as heading", () => {
    expect(defaultCsvRange(grid)).toEqual({ headerRow: 1, dataFrom: 2, dataTo: 7 });
  });

  it("uses the picked heading row and data range, and reports file line numbers", () => {
    const t = buildCsvTable(grid, { headerRow: 3, dataFrom: 4, dataTo: 5 });
    expect(t.headers).toEqual(["CODE", "D", "Price", "Stock"]);
    expect(t.rows).toEqual([
      { CODE: "A1", D: "3", Price: "100", Stock: "5" },
      { CODE: "A2", D: "4", Price: "200", Stock: "6" },
    ]);
    expect(t.rowNumbers).toEqual([4, 5]);
  });

  it("leaves out rows outside the range (the Total line) and skips blank lines inside it", () => {
    const t = buildCsvTable(grid, { headerRow: 3, dataFrom: 4, dataTo: 7 });
    expect(t.rowNumbers).toEqual([4, 5, 7]); // line 6 is blank
    const without = buildCsvTable(grid, { headerRow: 3, dataFrom: 4, dataTo: 6 });
    expect(without.rowNumbers).toEqual([4, 5]);
  });

  it("never treats the heading line as data", () => {
    const t = buildCsvTable(grid, { headerRow: 3, dataFrom: 1, dataTo: 5 });
    expect(t.rowNumbers).toEqual([1, 4, 5]);
  });

  it("keeps values aligned when a heading cell in the middle is blank, and numbers duplicate headings", () => {
    const g = parseCsvGrid("CODE,,Price,Price\nA1,x,100,110");
    const t = buildCsvTable(g, { headerRow: 1, dataFrom: 2, dataTo: 2 });
    expect(t.headers).toEqual(["CODE", "Price", "Price (2)"]);
    expect(t.rows[0]).toEqual({ CODE: "A1", Price: "100", "Price (2)": "110" });
  });

  it("gives no columns for an empty heading row and no rows for an inverted range", () => {
    const empty = buildCsvTable(grid, { headerRow: 2, dataFrom: 3, dataTo: 7 });
    expect(empty).toEqual({ headers: [], rows: [], rowNumbers: [] });
    expect(buildCsvTable(grid, { headerRow: 3, dataFrom: 6, dataTo: 4 }).rows).toEqual([]);
  });
});

describe("clampCsvRange / guessColumnMapping", () => {
  it("keeps typed rows inside the file", () => {
    const grid = parseCsvGrid(file);
    expect(clampCsvRange(grid, { headerRow: 0, dataFrom: 99, dataTo: -3 })).toEqual({ headerRow: 1, dataFrom: 7, dataTo: 1 });
  });

  it("guesses system fields from headings", () => {
    expect(guessColumnMapping(["CODE", "D", "Price", "Stock", "Coating"])).toEqual({
      CODE: "sku",
      D: "diameter",
      Price: "listPrice",
      Stock: "stockQuantity",
      Coating: "Coating",
    });
  });
});
