import type { FibLineStyle } from "@/lib/fibonacci";

export type TrendLineEnd = "normal" | "arrow";

/** Per-drawing style, editable from the settings dialog */
export interface TrendLineSettings {
  color: string;
  width: number;
  style: FibLineStyle;
  /** Extend past the leftmost / rightmost point to the chart edge */
  extendLeft: boolean;
  extendRight: boolean;
  leftEnd: TrendLineEnd;
  rightEnd: TrendLineEnd;
  middlePoint: boolean;
  priceLabels: boolean;
  /** Price change, %, bars, duration and angle next to the second point */
  stats: boolean;
  /** Text drawn along the line (empty = none) */
  text: string;
  fontSize: number;
}

// TradingView defaults: blue, 2px, solid, nothing else on
export function defaultTrendLineSettings(): TrendLineSettings {
  return {
    color: "#2962ff",
    width: 2,
    style: "solid",
    extendLeft: false,
    extendRight: false,
    leftEnd: "normal",
    rightEnd: "normal",
    middlePoint: false,
    priceLabels: false,
    stats: false,
    text: "",
    fontSize: 14,
  };
}

/** Drawings saved before a setting existed get its default */
export function trendLineSettingsOf(s: Partial<TrendLineSettings> | undefined): TrendLineSettings {
  return { ...defaultTrendLineSettings(), ...s };
}

interface Px {
  x: number;
  y: number;
}

/**
 * Segment actually drawn: A→B with the requested sides extended to the edge
 * of the drawing area (Liang–Barsky clip of the infinite line). Returned
 * left point first.
 */
export function trendSegment(
  a: Px,
  b: Px,
  settings: Pick<TrendLineSettings, "extendLeft" | "extendRight">,
  width: number,
  height: number,
): [Px, Px] {
  const [l, r] = a.x <= b.x ? [a, b] : [b, a];
  const dx = r.x - l.x;
  const dy = r.y - l.y;
  if ((!settings.extendLeft && !settings.extendRight) || (dx === 0 && dy === 0)) return [l, r];
  let t0 = -Infinity;
  let t1 = Infinity;
  const clip = (p: number, q: number) => {
    // p·t <= q
    if (p === 0) return;
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
  };
  clip(-dx, l.x);
  clip(dx, width - l.x);
  clip(-dy, l.y);
  clip(dy, height - l.y);
  const at = (t: number) => ({ x: l.x + dx * t, y: l.y + dy * t });
  // Line misses the visible area: nothing to extend into
  if (t0 > t1) return [l, r];
  return [
    settings.extendLeft && t0 < 0 ? at(t0) : l,
    settings.extendRight && t1 > 1 ? at(t1) : r,
  ];
}
