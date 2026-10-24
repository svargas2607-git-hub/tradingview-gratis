import type { FibDrawing, FibKind, FibPoint } from "@/lib/store/chart-store";

export interface FibLevelDef {
  ratio: number;
  color: string;
  /** Unchecked levels stay in the list but are not drawn (like TradingView) */
  enabled: boolean;
}

export type FibLineStyle = "solid" | "dashed" | "dotted";
export type FibLabelSide = "left" | "right";
export type FibLabelVertical = "top" | "middle" | "bottom";

/** Per-drawing style, editable from the settings dialog */
export interface FibSettings {
  levels: FibLevelDef[];
  trendLine: { visible: boolean; color: string; style: FibLineStyle };
  levelsLine: { width: number; style: FibLineStyle };
  extendLeft: boolean;
  extendRight: boolean;
  /** Swap the anchor the levels are measured from */
  reverse: boolean;
  background: boolean;
  /** Fill opacity, 0–100 */
  backgroundOpacity: number;
  /** Paint every level with this color instead of its own */
  oneColor: string | null;
  showLevels: boolean;
  showPrices: boolean;
  /** Show 61.8% instead of 0.618 */
  levelsAsPercent: boolean;
  labelSide: FibLabelSide;
  /** Label above, on or below its line (missing on older drawings → middle) */
  labelVertical?: FibLabelVertical;
  fontSize: number;
}

const lv = (ratio: number, color: string, enabled = true): FibLevelDef => ({
  ratio,
  color,
  enabled,
});

// User's preferred retracement: a level every 10% up to 60%, then 80%,
// 100% and extensions every 25% up to 200%
export const RETRACEMENT_LEVELS: FibLevelDef[] = [
  lv(0, "#9c9c9c"),
  lv(0.1, "#e91e63"),
  lv(0.2, "#e91e63"),
  lv(0.3, "#e91e63"),
  lv(0.4, "#f7525f"),
  lv(0.5, "#f7525f"),
  lv(0.6, "#00bcd4"),
  lv(0.8, "#00bcd4"),
  lv(1, "#9c9c9c"),
  lv(1.25, "#4caf50"),
  lv(1.5, "#4caf50"),
  lv(1.75, "#4caf50"),
  lv(2, "#4caf50"),
];

/** Retracement levels shipped before matching TradingView's 24 slots */
const OLD_RETRACEMENT_RATIOS = [
  0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236, 1.272, 1.414, 2, -0.236, -0.618,
];

/**
 * Brings drawings saved with the old retracement defaults up to the
 * TradingView ones. Customized drawings are left untouched.
 */
export function migrateOldFibSettings(s: FibSettings): FibSettings {
  const ratios = s.levels.map((l) => l.ratio);
  const isOld =
    ratios.length === OLD_RETRACEMENT_RATIOS.length &&
    ratios.every((r, i) => r === OLD_RETRACEMENT_RATIOS[i]);
  if (!isOld) return s;
  return {
    ...s,
    levels: RETRACEMENT_LEVELS.map((l) => ({ ...l })),
    backgroundOpacity: s.backgroundOpacity === 10 ? 20 : s.backgroundOpacity,
    fontSize: s.fontSize === 10 ? 12 : s.fontSize,
  };
}

export const EXTENSION_LEVELS: FibLevelDef[] = [
  lv(0, "#787b86"),
  lv(0.236, "#f23645"),
  lv(0.382, "#ff9800"),
  lv(0.5, "#4caf50"),
  lv(0.618, "#089981"),
  lv(0.786, "#00bcd4"),
  lv(1, "#787b86"),
  lv(1.272, "#9c27b0"),
  lv(1.618, "#2962ff"),
  lv(2, "#e91e63"),
  lv(2.618, "#f23645"),
  lv(3.618, "#9c27b0", false),
  lv(4.236, "#e91e63", false),
];

export function defaultFibSettings(kind: FibKind): FibSettings {
  const base: FibSettings = {
    levels: EXTENSION_LEVELS.map((l) => ({ ...l })),
    trendLine: { visible: true, color: "#787b86", style: "dashed" },
    levelsLine: { width: 1, style: "solid" },
    extendLeft: false,
    extendRight: false,
    reverse: false,
    background: true,
    // TradingView: transparency 80
    backgroundOpacity: 20,
    oneColor: null,
    showLevels: true,
    showPrices: true,
    levelsAsPercent: false,
    labelSide: "left",
    labelVertical: "middle",
    fontSize: 12,
  };
  if (kind === "extension") return base;
  // Retracement as the user sets it up in TradingView: 100% at the first
  // click and 0% at the second, no background, percent labels on the right,
  // above each line
  return {
    ...base,
    levels: RETRACEMENT_LEVELS.map((l) => ({ ...l })),
    reverse: false,
    background: false,
    levelsAsPercent: true,
    labelSide: "right",
    labelVertical: "top",
  };
}

/** Drawings saved before settings existed fall back to the defaults */
export function fibSettingsOf(f: Pick<FibDrawing, "kind" | "settings">): FibSettings {
  return f.settings ?? defaultFibSettings(f.kind);
}

export function cloneFibSettings(s: FibSettings): FibSettings {
  return {
    ...s,
    levels: s.levels.map((l) => ({ ...l })),
    trendLine: { ...s.trendLine },
    levelsLine: { ...s.levelsLine },
  };
}

export function dashArray(style: FibLineStyle, width = 1): string | undefined {
  if (style === "dashed") return `${4 * width},${3 * width}`;
  if (style === "dotted") return `${width},${2 * width}`;
  return undefined;
}

export function formatRatio(ratio: number, asPercent: boolean): string {
  if (!asPercent) return String(ratio);
  return `${(ratio * 100).toFixed(2)}%`;
}

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
 * `reverse` flips the direction the ratios are measured in.
 * Only enabled levels are returned, sorted by ratio.
 */
export function fibLevels(kind: FibKind, points: FibPoint[], settings: FibSettings): FibLevel[] {
  const levels = settings.levels
    .filter((l) => l.enabled && isFinite(l.ratio))
    .sort((x, y) => x.ratio - y.ratio);
  const color = (l: FibLevelDef) => settings.oneColor ?? l.color;
  if (kind === "retracement") {
    const [a, b] = points;
    if (!a || !b) return [];
    const [from, to] = settings.reverse ? [a, b] : [b, a];
    return levels.map((l) => ({
      ...l,
      color: color(l),
      price: from.price + (to.price - from.price) * l.ratio,
    }));
  }
  const [a, b, c] = points;
  if (!a || !b || !c) return [];
  const move = (b.price - a.price) * (settings.reverse ? -1 : 1);
  return levels.map((l) => ({
    ...l,
    color: color(l),
    price: c.price + move * l.ratio,
  }));
}
