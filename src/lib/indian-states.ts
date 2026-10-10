/** GST state codes (used for Place of Supply and CGST/SGST vs IGST). */
export const INDIAN_STATES: { code: string; name: string }[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
];

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");

/** "24-Gujarat" for a state name or code; null when unrecognised. */
export function placeOfSupplyFor(stateNameOrCode: string | null | undefined): string | null {
  const raw = (stateNameOrCode ?? "").trim();
  if (!raw) return null;
  const byCode = INDIAN_STATES.find((s) => s.code === raw.padStart(2, "0") && /^\d{1,2}$/.test(raw));
  const key = norm(raw);
  const hit =
    byCode ??
    INDIAN_STATES.find((s) => norm(s.name) === key) ??
    // Common alternates: "Orissa", "Pondicherry", "Daman", "Dadra", "J&K".
    INDIAN_STATES.find((s) => key.length >= 5 && norm(s.name).startsWith(key));
  return hit ? `${hit.code}-${hit.name}` : null;
}
