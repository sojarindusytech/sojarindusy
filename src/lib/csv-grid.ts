/**
 * Pure helpers for the SKU CSV import: parse a file into a raw grid of lines, then build the
 * table from the heading row and data rows the admin picked. Row numbers are 1-based file lines
 * (blank lines included), so they match what the admin sees in Excel or a text editor.
 */

export interface CsvRange {
  /** 1-based line holding the column names. */
  headerRow: number;
  /** First data line (inclusive). */
  dataFrom: number;
  /** Last data line (inclusive). */
  dataTo: number;
}

export interface CsvTable {
  headers: string[];
  rows: Record<string, string>[];
  /** File line number of each row, for the preview. */
  rowNumbers: number[];
}

const DELIMITERS = [",", "\t", ";"] as const;

function splitLine(line: string, delimiter: string): string[] {
  const tokens: string[] = [];
  let token = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        token += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      tokens.push(token.trim());
      token = "";
    } else {
      token += ch;
    }
  }
  tokens.push(token.trim());
  return tokens;
}

/** Comma, tab or semicolon: whichever appears most across the first lines (a title row above the heading can't fool it). */
function detectDelimiter(lines: string[]): string {
  const sample = lines.filter((l) => l.trim() !== "").slice(0, 20);
  let best = ",";
  let bestCount = 0;
  for (const d of DELIMITERS) {
    const count = sample.reduce((n, l) => n + l.split(d).length - 1, 0);
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** Every line of the file as cells. Blank lines stay (as empty rows) so line numbers match the file. */
export function parseCsvGrid(text: string): string[][] {
  const lines = text.replace(/^﻿/, "").split(/\r\n|\n|\r/);
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  if (lines.length === 0) return [];
  const delimiter = detectDelimiter(lines);
  return lines.map((l) => (l.trim() === "" ? [] : splitLine(l, delimiter)));
}

const isBlankRow = (cells: string[] | undefined) => !cells || cells.every((c) => c === "");

/** Heading = first non-empty line, data = everything after it. */
export function defaultCsvRange(grid: string[][]): CsvRange {
  const first = grid.findIndex((r) => !isBlankRow(r));
  const headerRow = first === -1 ? 1 : first + 1;
  return { headerRow, dataFrom: headerRow + 1, dataTo: Math.max(grid.length, headerRow + 1) };
}

/** Keeps a typed range inside the file and the data after the heading. */
export function clampCsvRange(grid: string[][], range: CsvRange): CsvRange {
  const last = Math.max(grid.length, 1);
  const clamp = (n: number) => Math.min(Math.max(Math.trunc(n) || 1, 1), last);
  return { headerRow: clamp(range.headerRow), dataFrom: clamp(range.dataFrom), dataTo: clamp(range.dataTo) };
}

/** Columns with a name in the heading row, rows from the data range. Blank data lines are skipped. */
export function buildCsvTable(grid: string[][], range: CsvRange): CsvTable {
  const headerCells = grid[range.headerRow - 1] ?? [];

  // Keep each column's original position so a blank heading cell in the middle can't shift the data.
  const columns: { name: string; index: number }[] = [];
  const seen = new Map<string, number>();
  headerCells.forEach((raw, index) => {
    const base = raw.trim();
    if (!base) return;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    columns.push({ name: n === 1 ? base : `${base} (${n})`, index });
  });

  const rows: Record<string, string>[] = [];
  const rowNumbers: number[] = [];
  if (columns.length === 0) return { headers: [], rows, rowNumbers };
  for (let line = range.dataFrom; line <= Math.min(range.dataTo, grid.length); line++) {
    if (line === range.headerRow) continue;
    const cells = grid[line - 1];
    if (isBlankRow(cells)) continue;
    const row: Record<string, string> = {};
    for (const c of columns) row[c.name] = cells[c.index] ?? "";
    rows.push(row);
    rowNumbers.push(line);
  }
  return { headers: columns.map((c) => c.name), rows, rowNumbers };
}

/** First guess at which system field a CSV column is, from its heading. Unknown columns stay dynamic attributes. */
export function guessFieldForHeader(header: string): string {
  const lower = header.toLowerCase().trim();
  if (lower.includes("code") || lower.includes("sku")) return "sku";
  if (lower === "d" || lower === "dia" || lower.includes("diameter")) return "diameter";
  if (lower === "h" || lower.includes("flute")) return "fluteLength";
  if (lower === "l" || lower.includes("overall")) return "overallLength";
  if (lower === "d2" || lower.includes("shank")) return "shankDia";
  if (lower.includes("price")) return "listPrice";
  if (lower.includes("trigger") || lower.includes("reorder")) return "triggerQuantity";
  if (lower.includes("target") || /min.*(sku|stock|level)/.test(lower)) return "minQuantity";
  if (lower.includes("moq") || lower.includes("min")) return "minOrderQuantity";
  if (lower.includes("stock") || lower.includes("qty")) return "stockQuantity";
  return header;
}

export function guessColumnMapping(headers: string[]): Record<string, string> {
  return Object.fromEntries(headers.map((h) => [h, guessFieldForHeader(h)]));
}
