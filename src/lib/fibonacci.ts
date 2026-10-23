import type { FibKind, FibPoint } from "@/lib/store/chart-store";

export interface FibLevelDef {
  ratio: number;
  color: string;
}

// Same default levels / colors as TradingView
export const RETRACEMENT_LEVELS: FibLevelDef[] = [
  { ratio: 0, color: "#787b86" },
  { ratio: 0.236, color: "#f23645" },
  { ratio: 0.382, color: "#ff9800" },
  { ratio: 0.5, color: "#4caf50" },
  { ratio: 0.618, color: "#089981" },
  { ratio: 0.786, color: "#00bcd4" },
  { ratio: 1, color: "#787b86" },
  { ratio: 1.618, color: "#2962ff" },
  { ratio: 2.618, color: "#f23645" },
];

export const EXTENSION_LEVELS: FibLevelDef[] = [
  { ratio: 0, color: "#787b86" },
  { ratio: 0.236, color: "#f23645" },
  { ratio: 0.382, color: "#ff9800" },
  { ratio: 0.5, color: "#4caf50" },
  { ratio: 0.618, color: "#089981" },
  { ratio: 0.786, color: "#00bcd4" },
  { ratio: 1, color: "#787b86" },
  { ratio: 1.272, color: "#9c27b0" },
  { ratio: 1.618, color: "#2962ff" },
  { ratio: 2, color: "#e91e63" },
  { ratio: 2.618, color: "#f23645" },
];

/** Clicks needed to finish each drawing */
export const FIB_POINT_COUNT: Record<FibKind, number> = {
  retracement: 2,
  extension: 3,
};

export interface FibLevel extends FibLevelDef {
  price: number;
}

/**
 * Retracement (A → B): level 1 sits at A, level 0 at B.
 *   price = B + (A − B) · ratio
 * Trend-based extension (A → B, retrace to C): projects the A→B move from C.
 *   price = C + (B − A) · ratio
 */
export function fibLevels(kind: FibKind, points: FibPoint[]): FibLevel[] {
  if (kind === "retracement") {
    const [a, b] = points;
    if (!a || !b) return [];
    return RETRACEMENT_LEVELS.map((l) => ({
      ...l,
      price: b.price + (a.price - b.price) * l.ratio,
    }));
  }
  const [a, b, c] = points;
  if (!a || !b || !c) return [];
  return EXTENSION_LEVELS.map((l) => ({
    ...l,
    price: c.price + (b.price - a.price) * l.ratio,
  }));
}
