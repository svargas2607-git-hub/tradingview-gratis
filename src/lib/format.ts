export function formatPrice(n: number): string {
  if (!isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

export function formatPct(n: number): string {
  if (!isFinite(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function formatVolume(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}

/**
 * Decimals kept when editing a price: one for big prices (BTC), more for
 * cheaper ones so they don't collapse to 0.1.
 */
export function priceDecimals(n: number): number {
  const a = Math.abs(n);
  if (a >= 100) return 1;
  if (a >= 1) return 2;
  if (a >= 0.01) return 4;
  return 6;
}

export function roundPrice(n: number): number {
  return +n.toFixed(priceDecimals(n));
}
