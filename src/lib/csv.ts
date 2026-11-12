/**
 * One CSV cell, safe to open in Excel / Sheets. Values come from customers (company names, etc.),
 * so a cell starting with = + - @ (or tab / CR) is prefixed with an apostrophe: spreadsheets would
 * otherwise run it as a formula. Quotes are doubled so a name containing " cannot break the row.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export const csvRow = (cells: unknown[]): string => cells.map(csvCell).join(",");

/** Downloads rows as a UTF-8 CSV (BOM so Excel reads rupee signs and accents correctly). */
export function downloadCsv(filename: string, header: string[], rows: unknown[][]): void {
  const body = [header.map(csvCell).join(","), ...rows.map(csvRow)].join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
