import type { FibPoint, PositionDrawing } from "@/lib/store/chart-store";

export type PositionSide = "long" | "short";

/** Per-drawing inputs and style, editable from the settings dialog */
export interface PositionSettings {
  /** Account balance the risk is taken from */
  accountSize: number;
  /** Units per lot (quantity is shown in units of the asset) */
  lotSize: number;
  /** % of the account lost if the stop is hit */
  riskPct: number;
  profitColor: string;
  stopColor: string;
  /** Fill opacity of the target / stop zones, 0–100 */
  opacity: number;
  lineColor: string;
  textColor: string;
  fontSize: number;
  /** Shorter labels: just % and amount */
  compactStats: boolean;
  /** Center label (P&L, quantity, ratio) even when not selected */
  alwaysShowStats: boolean;
  showLabels: boolean;
}

// TradingView defaults: 1000 account, lot 1, 25% risk, teal / red zones
export function defaultPositionSettings(): PositionSettings {
  return {
    accountSize: 1000,
    lotSize: 1,
    riskPct: 25,
    profitColor: "#089981",
    stopColor: "#f23645",
    opacity: 20,
    lineColor: "#787b86",
    textColor: "#ffffff",
    fontSize: 12,
    compactStats: false,
    alwaysShowStats: false,
    showLabels: true,
  };
}

/** Drawings saved before a setting existed get its default */
export function positionSettingsOf(s: Partial<PositionSettings> | undefined): PositionSettings {
  return { ...defaultPositionSettings(), ...s };
}

/** Where the position sits on the chart */
export interface PositionShape {
  /** Start time and entry price */
  entry: FibPoint;
  endTime: number;
  tp: number;
  sl: number;
}

/**
 * Draggable handles, in order: entry (left edge), target (left edge),
 * stop (left edge), width (right edge at the entry price).
 */
export function positionAnchors(d: PositionShape): FibPoint[] {
  return [
    { ...d.entry },
    { time: d.entry.time, price: d.tp },
    { time: d.entry.time, price: d.sl },
    { time: d.endTime, price: d.entry.price },
  ];
}

export function positionFromAnchors(pts: FibPoint[]): PositionShape {
  return { entry: { ...pts[0] }, tp: pts[1].price, sl: pts[2].price, endTime: pts[3].time };
}

/**
 * Anchors after dragging handle `anchor` to `p`. Each handle only moves its
 * own value, the target stays on the profit side and the stop on the loss
 * side, and the box is at least `minDt` seconds wide.
 */
export function dragPositionAnchor(
  side: PositionSide,
  orig: FibPoint[],
  anchor: number,
  p: FibPoint,
  minDt: number,
): FibPoint[] {
  let { entry, tp, sl, endTime } = positionFromAnchors(orig);
  const up = side === "long" ? 1 : -1;
  const eps = Math.abs(entry.price) * 1e-6 || 1e-9;
  if (anchor === 0) {
    const lo = Math.min(tp, sl) + eps;
    const hi = Math.max(tp, sl) - eps;
    entry = { time: Math.min(p.time, endTime - minDt), price: Math.max(lo, Math.min(hi, p.price)) };
  } else if (anchor === 1) {
    tp = up > 0 ? Math.max(p.price, entry.price + eps) : Math.min(p.price, entry.price - eps);
  } else if (anchor === 2) {
    sl = up > 0 ? Math.min(p.price, entry.price - eps) : Math.max(p.price, entry.price + eps);
  } else {
    endTime = Math.max(p.time, entry.time + minDt);
  }
  return positionAnchors({ entry, tp, sl, endTime });
}

export interface PositionStats {
  /** Units bought / sold so a stop loses riskPct of the account */
  qty: number;
  targetPct: number;
  stopPct: number;
  targetAmount: number;
  stopAmount: number;
  /** Reward / risk */
  ratio: number;
}

export function positionStats(d: Pick<PositionDrawing, "entry" | "tp" | "sl">, s: PositionSettings): PositionStats {
  const entry = d.entry.price;
  const reward = Math.abs(d.tp - entry);
  const risk = Math.abs(entry - d.sl);
  const riskAmount = (s.accountSize * s.riskPct) / 100;
  const qty = risk === 0 || s.lotSize === 0 ? 0 : riskAmount / (risk * s.lotSize);
  return {
    qty,
    targetPct: entry === 0 ? 0 : (reward / entry) * 100,
    stopPct: entry === 0 ? 0 : (risk / entry) * 100,
    targetAmount: qty * s.lotSize * reward,
    stopAmount: qty * s.lotSize * risk,
    ratio: risk === 0 ? 0 : reward / risk,
  };
}

export interface PositionOutcome {
  /** waiting: price never reached the entry · open: in the trade, no exit yet */
  status: "waiting" | "open" | "target" | "stop";
  /** When price reached the entry */
  openTime?: number;
  /** Exit (target / stop) or, while open, the last price inside the box */
  exitTime?: number;
  exitPrice?: number;
}

interface Bar {
  time: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Replays the bars inside the box like TradingView: the trade opens on the
 * first bar that touches the entry, then closes on the first bar that
 * touches the stop (checked first, the conservative case) or the target.
 */
export function positionOutcome(d: PositionShape, side: PositionSide, bars: readonly Bar[]): PositionOutcome {
  const entry = d.entry.price;
  let openTime: number | undefined;
  let last: Bar | undefined;
  for (const b of bars) {
    if (b.time < d.entry.time) continue;
    if (b.time > d.endTime) break;
    if (openTime === undefined) {
      if (b.low > entry || b.high < entry) continue;
      openTime = b.time;
    }
    last = b;
    const hitStop = side === "long" ? b.low <= d.sl : b.high >= d.sl;
    if (hitStop) return { status: "stop", openTime, exitTime: b.time, exitPrice: d.sl };
    const hitTarget = side === "long" ? b.high >= d.tp : b.low <= d.tp;
    if (hitTarget) return { status: "target", openTime, exitTime: b.time, exitPrice: d.tp };
  }
  if (openTime === undefined || !last) return { status: "waiting" };
  return { status: "open", openTime, exitTime: last.time, exitPrice: last.close };
}
