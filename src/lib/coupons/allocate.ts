/**
 * Splits an order-level coupon discount across the order lines it applies to,
 * in proportion to each line's value, in whole paise.
 *
 * GST is charged per line on (line value - line discount), and the invoice
 * shows a discount on each line, so the discount must be assigned to lines,
 * not just to the order. Leftover paise go to the lines with the largest
 * remainders (ties: earlier line), so the parts always add up exactly.
 */
export function allocateDiscount(
  lines: { lineTotal: number; eligible: boolean }[],
  discount: number
): number[] {
  const toPaise = (v: number) => Math.round(v * 100);
  const weights = lines.map((l) => (l.eligible ? Math.max(0, toPaise(l.lineTotal)) : 0));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const discountPaise = Math.min(Math.max(0, toPaise(discount)), totalWeight);

  if (discountPaise === 0 || totalWeight === 0) return lines.map(() => 0);

  const exact = weights.map((w) => (w * discountPaise) / totalWeight);
  const shares = exact.map(Math.floor);
  let leftover = discountPaise - shares.reduce((a, b) => a + b, 0);

  const byRemainder = exact
    .map((v, i) => ({ i, remainder: v - Math.floor(v) }))
    .filter(({ i }) => weights[i] > 0)
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);

  for (const { i } of byRemainder) {
    if (leftover === 0) break;
    if (shares[i] < weights[i]) {
      shares[i] += 1;
      leftover -= 1;
    }
  }

  return shares.map((p) => p / 100);
}
