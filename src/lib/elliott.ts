export type ElliottKind = "impulse" | "correction";

/** Clicks needed to place each wave: origin plus every wave end */
export const ELLIOTT_POINT_COUNT: Record<ElliottKind, number> = {
  impulse: 6,
  correction: 4,
};

// TradingView names: impulse (0)–(5), correction (0)(A)(B)(C)
const ELLIOTT_LABELS: Record<ElliottKind, string[]> = {
  impulse: ["(0)", "(1)", "(2)", "(3)", "(4)", "(5)"],
  correction: ["(0)", "(A)", "(B)", "(C)"],
};

export const ELLIOTT_COLORS: Record<ElliottKind, string> = {
  impulse: "#2962ff",
  correction: "#ff9800",
};

export function elliottLabel(kind: ElliottKind, index: number): string {
  return ELLIOTT_LABELS[kind][index] ?? "";
}

/**
 * Label goes above a swing high and below a swing low: compares the point
 * with its neighbours in the wave.
 */
export function elliottLabelAbove(prices: number[], index: number): boolean {
  const neighbours = [prices[index - 1], prices[index + 1]].filter((p) => p !== undefined);
  return neighbours.every((p) => prices[index] >= p);
}
