import type { Candle } from "@/lib/binance/types";

export type VpvrVolumeMode = "updown" | "total";
export type VpvrPlacement = "left" | "right";

/** Settings of the Volume Profile Visible Range indicator (TradingView's VPVR) */
export interface VpvrSettings {
  /** Number of rows the visible price range is split into */
  rows: number;
  volumeMode: VpvrVolumeMode;
  /** % of the total volume the value area holds */
  valueAreaPct: number;
  placement: VpvrPlacement;
  /** Widest bar, as % of the chart width */
  widthPct: number;

  upColor: string;
  downColor: string;
  vaUpColor: string;
  vaDownColor: string;
  /** Opacity of the histogram bars (0-100) */
  opacity: number;

  histogramBox: boolean;
  boxColor: string;

  poc: boolean;
  pocColor: string;
  pocWidth: number;
  /** POC line stretches across the whole chart instead of only the profile */
  pocExtend: boolean;

  vah: boolean;
  vahColor: string;
  val: boolean;
  valColor: string;
  vaLineWidth: number;

  developingPoc: boolean;
  developingPocColor: string;

  /** Volume text next to each row */
  values: boolean;
  valuesColor: string;
}

export function defaultVpvrSettings(): VpvrSettings {
  return {
    rows: 24,
    volumeMode: "updown",
    valueAreaPct: 70,
    placement: "right",
    widthPct: 70,

    upColor: "#2962ff",
    downColor: "#fbc02d",
    vaUpColor: "#2962ff",
    vaDownColor: "#fbc02d",
    opacity: 40,

    histogramBox: false,
    boxColor: "#787b86",

    poc: true,
    pocColor: "#ff5252",
    pocWidth: 1,
    pocExtend: false,

    vah: false,
    vahColor: "#2962ff",
    val: false,
    valColor: "#2962ff",
    vaLineWidth: 1,

    developingPoc: false,
    developingPocColor: "#f48fb1",

    values: false,
    valuesColor: "#787b86",
  };
}

/** Saved settings may predate newer fields: fill the gaps with the defaults */
export function vpvrSettingsOf(s: Partial<VpvrSettings> | null | undefined): VpvrSettings {
  return { ...defaultVpvrSettings(), ...s };
}

export interface VpvrRow {
  /** Price edges of the row */
  low: number;
  high: number;
  up: number;
  down: number;
  total: number;
  inValueArea: boolean;
}

export interface VpvrProfile {
  rows: VpvrRow[];
  /** Index in `rows` of the point of control (row with the most volume) */
  pocIndex: number;
  /** Highest / lowest row of the value area */
  vaHighIndex: number;
  vaLowIndex: number;
  maxVolume: number;
  /** POC after each candle of the range, oldest first */
  developingPoc: { time: number; price: number }[];
}

/**
 * Volume profile of `candles`: each candle's volume is spread over the rows
 * its high-low range touches (proportional to the overlap), and counted as up
 * volume when it closed at or above its open, down volume otherwise.
 */
export function computeVpvr(candles: readonly Candle[], settings: VpvrSettings): VpvrProfile | null {
  if (candles.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const c of candles) {
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }
  if (!isFinite(min) || !isFinite(max) || max <= min) return null;

  const n = Math.max(2, Math.round(settings.rows));
  const step = (max - min) / n;
  const up = new Array<number>(n).fill(0);
  const down = new Array<number>(n).fill(0);
  const total = new Array<number>(n).fill(0);
  const developingPoc: VpvrProfile["developingPoc"] = [];
  let pocIndex = 0;

  for (const c of candles) {
    const lo = Math.min(n - 1, Math.max(0, Math.floor((c.low - min) / step)));
    const hi = Math.min(n - 1, Math.max(0, Math.floor((c.high - min) / step)));
    const span = c.high - c.low;
    const bullish = c.close >= c.open;
    for (let r = lo; r <= hi; r++) {
      let share: number;
      if (span <= 0 || lo === hi) share = 1;
      else {
        const rowLo = min + r * step;
        const overlap = Math.min(c.high, rowLo + step) - Math.max(c.low, rowLo);
        share = Math.max(0, overlap) / span;
      }
      const v = c.volume * share;
      if (bullish) up[r] += v;
      else down[r] += v;
      total[r] += v;
      // Volumes only grow, so the POC can only move to a row that just grew
      if (total[r] > total[pocIndex]) pocIndex = r;
    }
    developingPoc.push({ time: c.time, price: min + (pocIndex + 0.5) * step });
  }

  // Final POC (the incremental one can tie-break differently)
  pocIndex = 0;
  for (let r = 1; r < n; r++) if (total[r] > total[pocIndex]) pocIndex = r;

  // Value area: grow from the POC towards whichever side adds more volume
  const sum = total.reduce((a, b) => a + b, 0);
  const target = sum * (settings.valueAreaPct / 100);
  let vaLow = pocIndex;
  let vaHigh = pocIndex;
  let acc = total[pocIndex];
  while (acc < target && (vaLow > 0 || vaHigh < n - 1)) {
    const above = vaHigh < n - 1 ? total[vaHigh + 1] + (vaHigh + 2 < n ? total[vaHigh + 2] : 0) : -1;
    const below = vaLow > 0 ? total[vaLow - 1] + (vaLow - 2 >= 0 ? total[vaLow - 2] : 0) : -1;
    if (above >= below) {
      vaHigh++;
      acc += total[vaHigh];
      if (acc < target && vaHigh < n - 1 && above >= 0) {
        // The pair is taken together, like TradingView
        vaHigh++;
        acc += total[vaHigh];
      }
    } else {
      vaLow--;
      acc += total[vaLow];
      if (acc < target && vaLow > 0) {
        vaLow--;
        acc += total[vaLow];
      }
    }
  }

  const rows: VpvrRow[] = [];
  let maxVolume = 0;
  for (let r = 0; r < n; r++) {
    maxVolume = Math.max(maxVolume, total[r]);
    rows.push({
      low: min + r * step,
      high: min + (r + 1) * step,
      up: up[r],
      down: down[r],
      total: total[r],
      inValueArea: r >= vaLow && r <= vaHigh,
    });
  }
  return { rows, pocIndex, vaHighIndex: vaHigh, vaLowIndex: vaLow, maxVolume, developingPoc };
}
