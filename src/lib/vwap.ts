import type { Candle, Timeframe } from "@/lib/binance/types";

export type VwapAnchor = "session" | "week" | "month" | "year" | "decade" | "century";
export type VwapSource = "open" | "high" | "low" | "close" | "hl2" | "hlc3" | "ohlc4" | "hlcc4";
export type VwapBandsMode = "stdev" | "percent";
export type VwapLineStyle = "solid" | "dashed" | "dotted";

export interface VwapBand {
  enabled: boolean;
  /** Standard deviations, or % of the VWAP, depending on the bands mode */
  multiplier: number;
  upperColor: string;
  lowerColor: string;
  fill: boolean;
  fillColor: string;
}

/** Settings of the Volume Weighted Average Price indicator (TradingView's VWAP) */
export interface VwapSettings {
  anchor: VwapAnchor;
  source: VwapSource;
  /** Bars the whole indicator is shifted (negative = to the left) */
  offset: number;
  /** Hide on 1D or higher timeframes */
  hideOnDwm: boolean;
  bandsMode: VwapBandsMode;
  bands: [VwapBand, VwapBand, VwapBand];

  lineVisible: boolean;
  color: string;
  width: number;
  style: VwapLineStyle;

  bandWidth: number;
  bandStyle: VwapLineStyle;
  /** Opacity of the fill between each pair of bands (0-100) */
  fillOpacity: number;

  /** Price tag of each plot on the price scale */
  labelsOnScale: boolean;
  /** Value in the indicator's label on the chart */
  valuesInLabel: boolean;
}

export function defaultVwapSettings(): VwapSettings {
  return {
    anchor: "session",
    source: "hlc3",
    offset: 0,
    hideOnDwm: false,
    bandsMode: "stdev",
    bands: [
      { enabled: true, multiplier: 1, upperColor: "#4caf50", lowerColor: "#4caf50", fill: true, fillColor: "#4caf50" },
      { enabled: false, multiplier: 2, upperColor: "#808000", lowerColor: "#808000", fill: true, fillColor: "#808000" },
      { enabled: false, multiplier: 3, upperColor: "#00897b", lowerColor: "#00897b", fill: true, fillColor: "#00897b" },
    ],

    lineVisible: true,
    color: "#2962ff",
    width: 1,
    style: "solid",

    bandWidth: 1,
    bandStyle: "solid",
    fillOpacity: 10,

    labelsOnScale: true,
    valuesInLabel: true,
  };
}

/** Saved settings may predate newer fields: fill the gaps with the defaults */
export function vwapSettingsOf(s: Partial<VwapSettings> | null | undefined): VwapSettings {
  const d = defaultVwapSettings();
  const merged = { ...d, ...s };
  merged.bands = d.bands.map((b, i) => ({ ...b, ...s?.bands?.[i] })) as VwapSettings["bands"];
  return merged;
}

export interface VwapPoint {
  time: number;
  vwap: number;
  /** Half-width of each band (same units as the price), 0 when it is off */
  offsets: [number, number, number];
  /** First bar of an anchor period: the line starts over here */
  start: boolean;
}

function sourceOf(c: Candle, source: VwapSource): number {
  switch (source) {
    case "open":
      return c.open;
    case "high":
      return c.high;
    case "low":
      return c.low;
    case "close":
      return c.close;
    case "hl2":
      return (c.high + c.low) / 2;
    case "hlc3":
      return (c.high + c.low + c.close) / 3;
    case "ohlc4":
      return (c.open + c.high + c.low + c.close) / 4;
    case "hlcc4":
      return (c.high + c.low + 2 * c.close) / 4;
  }
}

const DAY = 86400;

/** Identifier of the anchor period (UTC, like Binance's daily candles) a bar belongs to */
function periodKey(time: number, anchor: VwapAnchor): number {
  const d = new Date(time * 1000);
  const year = d.getUTCFullYear();
  switch (anchor) {
    case "session":
      return Math.floor(time / DAY);
    case "week":
      // Weeks start on Monday; 1970-01-05 was a Monday
      return Math.floor((time - 4 * DAY) / (7 * DAY));
    case "month":
      return year * 12 + d.getUTCMonth();
    case "year":
      return year;
    case "decade":
      return Math.floor(year / 10);
    case "century":
      return Math.floor(year / 100);
  }
}

/** Timeframes of one day or more */
export function isDailyOrHigher(timeframe: Timeframe): boolean {
  return timeframe === "1d" || timeframe === "3d" || timeframe === "1w" || timeframe === "1M";
}

/**
 * VWAP restarting at every anchor period: cumulative Σ(price·volume) / Σ(volume),
 * with bands at ± multiplier × the volume-weighted standard deviation (or % of the VWAP).
 */
export function computeVwap(candles: readonly Candle[], settings: VwapSettings): VwapPoint[] {
  const out: VwapPoint[] = [];
  let key: number | null = null;
  let sumPV = 0;
  let sumV = 0;
  let sumP2V = 0;
  let prevVwap = NaN;

  for (const c of candles) {
    const k = periodKey(c.time, settings.anchor);
    const start = k !== key;
    if (start) {
      key = k;
      sumPV = 0;
      sumV = 0;
      sumP2V = 0;
    }
    const price = sourceOf(c, settings.source);
    sumPV += price * c.volume;
    sumV += c.volume;
    sumP2V += price * price * c.volume;

    // A period without volume has no average yet: carry the price itself
    const vwap = sumV > 0 ? sumPV / sumV : price;
    const stdev = sumV > 0 ? Math.sqrt(Math.max(0, sumP2V / sumV - vwap * vwap)) : 0;
    const offsets = settings.bands.map((b) =>
      !b.enabled ? 0 : settings.bandsMode === "stdev" ? stdev * b.multiplier : (vwap * b.multiplier) / 100,
    ) as VwapPoint["offsets"];
    out.push({ time: c.time, vwap, offsets, start: start || Number.isNaN(prevVwap) });
    prevVwap = vwap;
  }
  return out;
}
