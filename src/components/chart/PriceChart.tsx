"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type Logical,
  type UTCTimestamp,
} from "lightweight-charts";
import { fetchKlines } from "@/lib/binance/rest";
import { getBinanceWS } from "@/lib/binance/ws";
import { ema, rsi, macd } from "@/lib/indicators";
import type { Candle, Timeframe } from "@/lib/binance/types";
import {
  INDICATOR_COLORS,
  useChartStore,
  type DrawingTool,
  type FibKind,
  type FibPoint,
  type IndicatorKey,
} from "@/lib/store/chart-store";
import { formatPrice, formatVolume } from "@/lib/format";
import {
  defaultFibSettings,
  FIB_POINT_COUNT,
  fibLevels,
  fibSettingsOf,
} from "@/lib/fibonacci";
import { IndicatorPill } from "./IndicatorPill";
import { MeasureOverlay } from "./MeasureOverlay";
import { FibOverlay, fibSpan, type FibGeometry } from "./FibOverlay";
import { FibToolbar } from "./FibToolbar";
import { TrendLineOverlay, type TrendGeometry } from "./TrendLineOverlay";
import { defaultTrendLineSettings, trendLineSettingsOf, trendSegment } from "@/lib/trendline";
import { PositionOverlay, type PositionGeometry, type PositionTrade } from "./PositionOverlay";
import {
  dragPositionAnchor,
  positionAnchors,
  positionFromAnchors,
  positionOutcome,
  positionSettingsOf,
  positionStats,
  type PositionSide,
} from "@/lib/position";
import { ELLIOTT_COLORS, ELLIOTT_POINT_COUNT, type ElliottKind } from "@/lib/elliott";
import { ElliottOverlay, type ElliottGeometry } from "./ElliottOverlay";
import { defaultRectangleSettings, rectangleBox, rectangleSettingsOf } from "@/lib/rectangle";
import { RectangleOverlay, type RectangleGeometry } from "./RectangleOverlay";

const ELLIOTT_TOOLS: Partial<Record<DrawingTool, ElliottKind>> = {
  elliottImpulse: "impulse",
  elliottCorrection: "correction",
};

const FIB_TOOLS: Partial<Record<DrawingTool, FibKind>> = {
  fibRetracement: "retracement",
  fibExtension: "extension",
};

const POSITION_TOOLS: Partial<Record<DrawingTool, PositionSide>> = {
  longPosition: "long",
  shortPosition: "short",
};

/** Fib being placed: the last point follows the mouse until clicked */
interface FibDraft {
  kind: FibKind;
  points: FibPoint[];
}

/** Elliott wave being placed: the last point follows the mouse until clicked */
interface ElliottDraft {
  kind: ElliottKind;
  points: FibPoint[];
}

/** Kind of drawing that can be selected and dragged */
type DrawingType = "fib" | "trend" | "position" | "elliott" | "rectangle";

/** Drawing being dragged: a single anchor, or the whole drawing (anchor = null) */
interface FibDrag {
  id: string;
  type: DrawingType;
  anchor: number | null;
  start: FibPoint;
  orig: FibPoint[];
  moved: boolean;
  /** Latest dragged position, committed on release */
  points?: FibPoint[];
}

interface FibHit {
  id: string;
  type: DrawingType;
  anchor: number | null;
  locked: boolean;
}

/** Hit tolerance in px for fib lines and anchors */
const HIT_PX = 6;
/** Weak magnet only snaps when an O/H/L/C is this close (px) */
const MAGNET_WEAK_PX = 20;

function distToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

interface MeasurePoint {
  time: number;
  price: number;
}
interface MeasureState {
  phase: "idle" | "placing" | "done";
  a: MeasurePoint | null;
  b: MeasurePoint | null;
}
const INITIAL_MEASURE: MeasureState = { phase: "idle", a: null, b: null };

function durationLabel(aTime: number, bTime: number): string {
  const diff = Math.abs(bTime - aTime);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

interface Props {
  symbol: string;
  timeframe: Timeframe;
}

const TV_COLORS = {
  bg: "#131722",
  panel: "#1e222d",
  border: "#2a2e39",
  text: "#d1d4dc",
  textMuted: "#787b86",
  green: "#26a69a",
  red: "#ef5350",
  blue: "#2962ff",
  yellow: "#ffb74d",
  purple: "#ab47bc",
  grid: "#1e222d",
};

interface HoverInfo {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  time: number;
  pct: number;
}

interface LastValues {
  ema20?: number;
  ema50?: number;
  ema200?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  volume?: number;
}

interface PaneOffset {
  top: number;
  height: number;
}

export function PriceChart({ symbol, timeframe }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi30Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsi70Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const macdRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const priceLinesMapRef = useRef<Map<string, IPriceLine>>(new Map());

  const indicators = useChartStore((s) => s.indicators);
  const hidden = useChartStore((s) => s.hidden);
  const config = useChartStore((s) => s.config);
  const tool = useChartStore((s) => s.tool);
  const priceLines = useChartStore((s) => s.priceLines);
  const fibs = useChartStore((s) => s.fibs);
  const fibDefaults = useChartStore((s) => s.fibDefaults);
  const selectedFibId = useChartStore((s) => s.selectedFibId);
  const trendLines = useChartStore((s) => s.trendLines);
  const trendLineDefaults = useChartStore((s) => s.trendLineDefaults);
  const positions = useChartStore((s) => s.positions);
  const elliotts = useChartStore((s) => s.elliotts);
  const rectangles = useChartStore((s) => s.rectangles);
  const rectangleDefaults = useChartStore((s) => s.rectangleDefaults);
  const addPriceLine = useChartStore((s) => s.addPriceLine);
  const removeIndicator = useChartStore((s) => s.removeIndicator);
  const toggleHidden = useChartStore((s) => s.toggleHidden);
  const setSettingsTarget = useChartStore((s) => s.setSettingsTarget);

  // Refs to avoid recreating subscribeClick on every tool change
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const addPriceLineRef = useRef(addPriceLine);
  addPriceLineRef.current = addPriceLine;
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;
  const configRef = useRef(config);
  configRef.current = config;

  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [lastPrice, setLastPrice] = useState<{ value: number; pct: number } | null>(null);
  const [lastValues, setLastValues] = useState<LastValues>({});
  const [paneOffsets, setPaneOffsets] = useState<PaneOffset[]>([]);
  const [measure, setMeasure] = useState<MeasureState>(INITIAL_MEASURE);
  const [renderTick, setRenderTick] = useState(0);
  const measureRef = useRef(measure);
  measureRef.current = measure;
  const [fibDraft, setFibDraft] = useState<FibDraft | null>(null);
  const fibDraftRef = useRef(fibDraft);
  fibDraftRef.current = fibDraft;
  const [elliottDraft, setElliottDraft] = useState<ElliottDraft | null>(null);
  const elliottDraftRef = useRef(elliottDraft);
  elliottDraftRef.current = elliottDraft;
  /** Rectangle being placed: the second corner follows the mouse until clicked */
  const [rectDraft, setRectDraft] = useState<FibPoint[] | null>(null);
  const rectDraftRef = useRef(rectDraft);
  rectDraftRef.current = rectDraft;
  /** Trend line being placed: B follows the mouse until clicked / released */
  const [trendDraft, setTrendDraft] = useState<FibPoint[] | null>(null);
  const trendDraftRef = useRef(trendDraft);
  trendDraftRef.current = trendDraft;
  /** Points of the drawing being dragged, committed to the store on release */
  const [fibDragPoints, setFibDragPoints] = useState<{ id: string; points: FibPoint[] } | null>(null);
  const fibDragRef = useRef<FibDrag | null>(null);
  /** Last rendered pixel layout of each visible fib, for hit-testing */
  const fibGeometryRef = useRef<Map<string, FibGeometry & { locked: boolean; background: boolean }>>(
    new Map(),
  );
  const trendGeometryRef = useRef<Map<string, TrendGeometry & { locked: boolean }>>(new Map());
  const positionGeometryRef = useRef<Map<string, PositionGeometry & { locked: boolean }>>(new Map());
  const elliottGeometryRef = useRef<Map<string, ElliottGeometry & { locked: boolean }>>(new Map());
  const rectGeometryRef = useRef<Map<string, RectangleGeometry & { locked: boolean }>>(new Map());
  /** Ctrl held: inverts the magnet while pressed */
  const ctrlHeldRef = useRef(false);
  /** Where the magnet snapped the cursor (px), shown as a dot */
  const [snapDot, setSnapDot] = useState<{ x: number; y: number } | null>(null);
  const magnet = useChartStore((s) => s.magnet);
  const magnetMode = useChartStore((s) => s.magnetMode);

  /** Seconds per bar, from the last two loaded candles */
  function barSeconds(data: readonly { time: unknown }[]): number {
    if (data.length < 2) return 60;
    return Number(data[data.length - 1].time) - Number(data[data.length - 2].time) || 60;
  }

  /**
   * Pixel X → time. Works past the last bar (future space) by extrapolating
   * with the bar duration, so fib points can be placed to the right.
   */
  function coordinateToTime(x: number): number | null {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chart || !series) return null;
    const data = series.data();
    if (data.length === 0) return null;
    const logical = chart.timeScale().coordinateToLogical(x);
    if (logical === null) return null;
    const idx = Math.round(logical);
    if (idx >= 0 && idx < data.length) return Number(data[idx].time);
    const sec = barSeconds(data);
    if (idx < 0) return Number(data[0].time) + idx * sec;
    return Number(data[data.length - 1].time) + (idx - (data.length - 1)) * sec;
  }

  /**
   * Time → pixel X. Handles times that are not exact bars (drawing made on
   * another timeframe) and times outside the loaded data.
   */
  function timeToCoordinate(t: number): number | null {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chart || !series) return null;
    const data = series.data();
    if (data.length === 0) return null;
    const sec = barSeconds(data);
    const first = Number(data[0].time);
    const lastIdx = data.length - 1;
    const last = Number(data[lastIdx].time);
    let logical: number;
    if (t < first) logical = (t - first) / sec;
    else if (t > last) logical = lastIdx + (t - last) / sec;
    else {
      // Last bar with time <= t
      let lo = 0;
      let hi = lastIdx;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (Number(data[mid].time) <= t) lo = mid;
        else hi = mid - 1;
      }
      logical = lo + (t - Number(data[lo].time)) / sec;
    }
    return chart.timeScale().logicalToCoordinate(logical as Logical);
  }

  /** Magnet is on, inverted while Ctrl is held (as in TradingView) */
  function magnetActive(): boolean {
    return useChartStore.getState().magnet !== ctrlHeldRef.current;
  }

  /**
   * Magnet: the O/H/L/C of the bar under the cursor closest to Y, or null when
   * it doesn't snap (off, outside the loaded bars, or weak and too far).
   */
  function magnetSnap(x: number, y: number): number | null {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chart || !series || !magnetActive()) return null;
    const data = series.data();
    const logical = chart.timeScale().coordinateToLogical(x);
    if (logical === null) return null;
    const bar = data[Math.round(logical)];
    if (!bar || !("open" in bar)) return null;
    let best: number | null = null;
    let bestDist = Infinity;
    for (const v of [bar.open, bar.high, bar.low, bar.close]) {
      const vy = series.priceToCoordinate(v);
      if (vy === null) continue;
      const d = Math.abs(vy - y);
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }
    if (useChartStore.getState().magnetMode === "weak" && bestDist > MAGNET_WEAK_PX) return null;
    return best;
  }

  /** Chart point under the pixel; `snap` applies the magnet */
  function pointAt(x: number, y: number, snap = true): FibPoint | null {
    const raw = candleSeriesRef.current?.coordinateToPrice(y);
    const time = coordinateToTime(x);
    if (raw === null || raw === undefined || !isFinite(raw) || time === null) return null;
    const snapped = snap ? magnetSnap(x, y) : null;
    return { time, price: snapped ?? raw };
  }
  const pointAtRef = useRef(pointAt);
  pointAtRef.current = pointAt;

  /** Moves the snap dot to where the magnet snaps `local` (null hides it) */
  function updateSnapDot(local: { x: number; y: number } | null) {
    const snapped = local && magnetSnap(local.x, local.y);
    const y = snapped !== null && snapped !== undefined ? candleSeriesRef.current?.priceToCoordinate(snapped) : null;
    const time = local && coordinateToTime(local.x);
    const x = time !== null && time !== undefined ? timeToCoordinate(time) : null;
    const next = x !== null && y !== null && y !== undefined ? { x, y } : null;
    setSnapDot((prev) => (prev?.x === next?.x && prev?.y === next?.y ? prev : next));
  }
  const updateSnapDotRef = useRef(updateSnapDot);
  updateSnapDotRef.current = updateSnapDot;

  /**
   * Places a position with one click at `local`, like TradingView: the stop
   * 10% of the pane height away, the target twice as far (ratio 2) and 15% of
   * the chart width wide.
   */
  function placePosition(side: PositionSide, local: { x: number; y: number }) {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    const entry = pointAt(local.x, local.y);
    if (!chart || !series || !entry) return;
    const yEntry = series.priceToCoordinate(entry.price) ?? local.y;
    const step = (chart.panes()[0]?.getHeight() ?? 400) * 0.1;
    const below = series.coordinateToPrice(yEntry + step);
    const endTime = coordinateToTime(local.x + chart.timeScale().width() * 0.15);
    if (below === null || endTime === null) return;
    const risk = Math.max(entry.price - below, entry.price * 1e-4);
    const dir = side === "long" ? 1 : -1;
    const store = useChartStore.getState();
    store.addPosition(
      side,
      {
        entry,
        endTime: Math.max(endTime, entry.time + barSeconds(series.data())),
        tp: entry.price + dir * risk * 2,
        sl: entry.price - dir * risk,
      },
      symbolRef.current,
    );
    store.setTool("cursor");
  }
  const placePositionRef = useRef(placePosition);
  placePositionRef.current = placePosition;

  /** Anchors of a position after dragging one of its handles */
  function dragPosition(id: string, orig: FibPoint[], anchor: number, p: FibPoint): FibPoint[] {
    const pos = useChartStore.getState().positions.find((q) => q.id === id);
    if (!pos) return orig;
    const minDt = barSeconds(candleSeriesRef.current?.data() ?? []);
    return dragPositionAnchor(pos.side, orig, anchor, p, minDt);
  }
  const dragPositionRef = useRef(dragPosition);
  dragPositionRef.current = dragPosition;

  // Helper — compute pane top offsets from chart layout
  function recomputePaneOffsets() {
    if (!chartRef.current) return;
    const panes = chartRef.current.panes();
    let top = 0;
    const offsets: PaneOffset[] = panes.map((p) => {
      const h = p.getHeight();
      const o = { top, height: h };
      top += h;
      return o;
    });
    setPaneOffsets(offsets);
  }

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: TV_COLORS.bg },
        textColor: TV_COLORS.text,
        fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
        fontSize: 11,
        panes: { separatorColor: TV_COLORS.border, separatorHoverColor: TV_COLORS.border },
      },
      grid: {
        vertLines: { color: TV_COLORS.grid },
        horzLines: { color: TV_COLORS.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: TV_COLORS.textMuted, width: 1, style: 3, labelBackgroundColor: TV_COLORS.panel },
        horzLine: { color: TV_COLORS.textMuted, width: 1, style: 3, labelBackgroundColor: TV_COLORS.panel },
      },
      rightPriceScale: {
        borderColor: TV_COLORS.border,
        textColor: TV_COLORS.textMuted,
      },
      timeScale: {
        borderColor: TV_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 8,
      },
      autoSize: true,
    });

    // PANE 0 — Candles + EMAs
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: TV_COLORS.green,
      downColor: TV_COLORS.red,
      borderUpColor: TV_COLORS.green,
      borderDownColor: TV_COLORS.red,
      wickUpColor: TV_COLORS.green,
      wickDownColor: TV_COLORS.red,
      priceLineColor: TV_COLORS.textMuted,
      priceLineStyle: 2,
    });

    ema20Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema20,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema50Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema50,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema200Ref.current = chart.addSeries(LineSeries, {
      color: INDICATOR_COLORS.ema200,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;

    // Click handler — add horizontal price line when hline tool is active
    chart.subscribeClick((param) => {
      if (!param.point || !candleSeriesRef.current) return;
      // Fib and trend line tools use their own DOM listeners (see effect below)
      if (
        FIB_TOOLS[toolRef.current] ||
        POSITION_TOOLS[toolRef.current] ||
        ELLIOTT_TOOLS[toolRef.current] ||
        toolRef.current === "rectangle" ||
        toolRef.current === "trendLine"
      ) {
        return;
      }

      const p = pointAtRef.current(param.point.x, param.point.y);
      if (!p) return;
      const price = p.price;

      if (toolRef.current === "hline") {
        addPriceLineRef.current(price, symbolRef.current);
        return;
      }

      if (toolRef.current === "measure") {
        if (!param.time) return;
        const time = Number(param.time);
        const current = measureRef.current;
        if (current.phase === "idle") {
          setMeasure({
            phase: "placing",
            a: { time, price },
            b: { time, price },
          });
        } else if (current.phase === "placing") {
          setMeasure({
            phase: "done",
            a: current.a,
            b: { time, price },
          });
        } else {
          setMeasure({
            phase: "placing",
            a: { time, price },
            b: { time, price },
          });
        }
      }
    });

    // Crosshair handler
    chart.subscribeCrosshairMove((param) => {
      if (
        toolRef.current === "measure" &&
        measureRef.current.phase === "placing" &&
        param.point &&
        param.time &&
        candleSeriesRef.current
      ) {
        const price = pointAtRef.current(param.point.x, param.point.y)?.price;
        if (price !== undefined) {
          const time = Number(param.time);
          setMeasure((prev) =>
            prev.phase === "placing" ? { ...prev, b: { time, price } } : prev,
          );
        }
      }

      if (!param.time || !candleSeriesRef.current) {
        setHover(null);
        return;
      }
      const data = param.seriesData.get(candleSeriesRef.current);
      const vol = volumeSeriesRef.current
        ? param.seriesData.get(volumeSeriesRef.current)
        : null;
      if (data && "open" in data) {
        const o = data.open as number;
        const c = data.close as number;
        setHover({
          o,
          h: data.high as number,
          l: data.low as number,
          c,
          v: vol && "value" in vol ? (vol.value as number) : 0,
          time: Number(param.time),
          pct: o === 0 ? 0 : ((c - o) / o) * 100,
        });
      }
    });

    // Re-render measure overlay on pan / zoom so pixel coords stay in sync
    const tsRangeHandler = () => setRenderTick((t) => t + 1);
    chart.timeScale().subscribeVisibleTimeRangeChange(tsRangeHandler);
    const logicalRangeHandler = () => setRenderTick((t) => t + 1);
    chart.timeScale().subscribeVisibleLogicalRangeChange(logicalRangeHandler);

    // ResizeObserver — recompute pane offsets when chart container resizes
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => recomputePaneOffsets());
    });
    ro.observe(containerRef.current);
    recomputePaneOffsets();

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(tsRangeHandler);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(logicalRangeHandler);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLinesMapRef.current.clear();
      ema20Ref.current = null;
      ema50Ref.current = null;
      ema200Ref.current = null;
      rsiRef.current = null;
      rsi30Ref.current = null;
      rsi70Ref.current = null;
      macdRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
    };
  }, []);

  // Manage volume — overlay at the bottom of the main pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.volume && !volumeSeriesRef.current) {
      const v = chartRef.current.addSeries(
        HistogramSeries,
        {
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
          color: TV_COLORS.textMuted,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        0,
      );
      v.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volumeSeriesRef.current = v;
      const data = candlesRef.current.map((k) => ({
        time: k.time as UTCTimestamp,
        value: k.volume,
        color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
      }));
      v.setData(data);
    } else if (!indicators.volume && volumeSeriesRef.current && chartRef.current) {
      chartRef.current.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
  }, [indicators.volume]);

  // RSI pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.rsi && !rsiRef.current) {
      const paneIndex = 1;
      const r = chartRef.current.addSeries(
        LineSeries,
        {
          color: INDICATOR_COLORS.rsi,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const r30 = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.textMuted,
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const r70 = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.textMuted,
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      rsiRef.current = r;
      rsi30Ref.current = r30;
      rsi70Ref.current = r70;
      try {
        chartRef.current.panes()[1]?.setStretchFactor(1);
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateRSI();
    } else if (!indicators.rsi && rsiRef.current && chartRef.current) {
      chartRef.current.removeSeries(rsiRef.current);
      if (rsi30Ref.current) chartRef.current.removeSeries(rsi30Ref.current);
      if (rsi70Ref.current) chartRef.current.removeSeries(rsi70Ref.current);
      rsiRef.current = null;
      rsi30Ref.current = null;
      rsi70Ref.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.rsi]);

  // MACD pane
  useEffect(() => {
    if (!chartRef.current) return;
    if (indicators.macd && !macdRef.current) {
      const paneIndex = indicators.rsi ? 2 : 1;
      const m = chartRef.current.addSeries(
        LineSeries,
        {
          color: INDICATOR_COLORS.macd,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const s = chartRef.current.addSeries(
        LineSeries,
        {
          color: TV_COLORS.yellow,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        },
        paneIndex,
      );
      const h = chartRef.current.addSeries(
        HistogramSeries,
        { priceLineVisible: false, lastValueVisible: false },
        paneIndex,
      );
      macdRef.current = m;
      macdSignalRef.current = s;
      macdHistRef.current = h;
      try {
        chartRef.current.panes()[paneIndex]?.setStretchFactor(1);
        chartRef.current.panes()[0]?.setStretchFactor(3);
      } catch {}
      updateMACD();
    } else if (!indicators.macd && macdRef.current && chartRef.current) {
      if (macdRef.current) chartRef.current.removeSeries(macdRef.current);
      if (macdSignalRef.current) chartRef.current.removeSeries(macdSignalRef.current);
      if (macdHistRef.current) chartRef.current.removeSeries(macdHistRef.current);
      macdRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
    }
    requestAnimationFrame(() => recomputePaneOffsets());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators.macd, indicators.rsi]);

  // Visibility — eye toggle (hidden state) + enabled state combined
  useEffect(() => {
    const v = (key: IndicatorKey) => indicators[key] && !hidden[key];
    ema20Ref.current?.applyOptions({ visible: v("ema20") });
    ema50Ref.current?.applyOptions({ visible: v("ema50") });
    ema200Ref.current?.applyOptions({ visible: v("ema200") });
    if (rsiRef.current) rsiRef.current.applyOptions({ visible: v("rsi") });
    if (rsi30Ref.current) rsi30Ref.current.applyOptions({ visible: v("rsi") });
    if (rsi70Ref.current) rsi70Ref.current.applyOptions({ visible: v("rsi") });
    if (macdRef.current) macdRef.current.applyOptions({ visible: v("macd") });
    if (macdSignalRef.current) macdSignalRef.current.applyOptions({ visible: v("macd") });
    if (macdHistRef.current) macdHistRef.current.applyOptions({ visible: v("macd") });
    if (volumeSeriesRef.current) volumeSeriesRef.current.applyOptions({ visible: v("volume") });
  }, [indicators, hidden]);

  // Recompute indicators when config changes (periods)
  useEffect(() => {
    updateEMAs();
  }, [config.ema20, config.ema50, config.ema200]);

  useEffect(() => {
    updateRSI();
  }, [config.rsi]);

  useEffect(() => {
    updateMACD();
  }, [config.macdFast, config.macdSlow, config.macdSignal]);

  // Sync price lines from store to the candle series
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    const map = priceLinesMapRef.current;
    const linesForThisSymbol = priceLines.filter((p) => p.symbol === symbol);
    const activeIds = new Set(linesForThisSymbol.map((p) => p.id));

    for (const [id, apiLine] of map.entries()) {
      if (!activeIds.has(id)) {
        try {
          series.removePriceLine(apiLine);
        } catch {}
        map.delete(id);
      }
    }
    for (const pl of linesForThisSymbol) {
      if (!map.has(pl.id)) {
        const apiLine = series.createPriceLine({
          price: pl.price,
          color: TV_COLORS.blue,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "",
        });
        map.set(pl.id, apiLine);
      }
    }
  }, [priceLines, symbol]);

  // Cursor style when drawing tools are active + reset measure on tool change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.cursor =
        tool === "hline" ||
        tool === "measure" ||
        tool === "trendLine" ||
        FIB_TOOLS[tool] ||
        POSITION_TOOLS[tool] ||
        ELLIOTT_TOOLS[tool] ||
        tool === "rectangle"
          ? "crosshair"
          : "";
    }
    if (tool !== "measure") setMeasure(INITIAL_MEASURE);
    setFibDraft(null);
    setElliottDraft(null);
    setRectDraft(null);
    setTrendDraft(null);
    if (tool !== "cursor") useChartStore.getState().selectFib(null);
    setSnapDot(null);
  }, [tool]);

  // Strong magnet: the crosshair also sticks to the OHLC while drawing.
  // Weak keeps the free crosshair and only shows the snap dot.
  const applyCrosshairModeRef = useRef(() => {});
  applyCrosshairModeRef.current = () => {
    const snaps =
      toolRef.current !== "cursor" && magnetActive() && useChartStore.getState().magnetMode === "strong";
    chartRef.current?.applyOptions({
      crosshair: { mode: snaps ? CrosshairMode.MagnetOHLC : CrosshairMode.Normal },
    });
  };
  useEffect(() => {
    applyCrosshairModeRef.current();
  }, [tool, magnet, magnetMode]);

  // Holding Ctrl inverts the magnet
  useEffect(() => {
    const set = (held: boolean) => {
      if (ctrlHeldRef.current === held) return;
      ctrlHeldRef.current = held;
      applyCrosshairModeRef.current();
      if (!held || !magnetActive()) setSnapDot(null);
    };
    const onKeyDown = (e: KeyboardEvent) => e.key === "Control" && set(true);
    const onKeyUp = (e: KeyboardEvent) => e.key === "Control" && set(false);
    const onBlur = () => set(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // Fib / trend line placement, selection and dragging. Uses raw DOM events instead of
  // chart.subscribeClick because the chart swallows a second click that comes
  // quickly (double-click).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let down: { x: number; y: number } | null = null;
    /** This press started a trend line: releasing after a drag finishes it */
    let trendStarted = false;

    /** Pointer position inside the main pane, or null if outside it */
    const localPoint = (e: MouseEvent) => {
      const chart = chartRef.current;
      if (!chart) return null;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const paneHeight = chart.panes()[0]?.getHeight() ?? 0;
      if (x < 0 || y < 0 || x > chart.timeScale().width() || y > paneHeight) return null;
      return { x, y };
    };

    /**
     * Topmost drawing under the pointer (anchors win over lines, then trend
     * lines, positions and fibs)
     */
    const hitTest = (p: { x: number; y: number }): FibHit | null => {
      const entries = [...fibGeometryRef.current.entries()].reverse();
      const trends = [...trendGeometryRef.current.entries()].reverse();
      const positionsGeo = [...positionGeometryRef.current.entries()].reverse();
      const waves = [...elliottGeometryRef.current.entries()].reverse();
      const rects = [...rectGeometryRef.current.entries()].reverse();
      const anchorOf = (pts: { x: number; y: number }[]) =>
        pts.findIndex((a) => Math.hypot(a.x - p.x, a.y - p.y) <= HIT_PX);
      for (const [id, g] of trends) {
        const anchor = anchorOf(g.points);
        if (anchor >= 0) return { id, type: "trend", anchor, locked: g.locked };
      }
      for (const [id, g] of positionsGeo) {
        const anchor = anchorOf(g.points);
        if (anchor >= 0) return { id, type: "position", anchor, locked: g.locked };
      }
      for (const [id, g] of waves) {
        const anchor = anchorOf(g.points);
        if (anchor >= 0) return { id, type: "elliott", anchor, locked: g.locked };
      }
      for (const [id, g] of rects) {
        const anchor = anchorOf(g.points);
        if (anchor >= 0) return { id, type: "rectangle", anchor, locked: g.locked };
      }
      for (const [id, g] of entries) {
        const anchor = anchorOf(g.points);
        if (anchor >= 0) return { id, type: "fib", anchor, locked: g.locked };
      }
      for (const [id, g] of trends) {
        if (distToSegment(p, g.segment[0], g.segment[1]) <= HIT_PX) {
          return { id, type: "trend", anchor: null, locked: g.locked };
        }
      }
      for (const [id, g] of waves) {
        if (g.points.some((a, i) => i > 0 && distToSegment(p, g.points[i - 1], a) <= HIT_PX)) {
          return { id, type: "elliott", anchor: null, locked: g.locked };
        }
      }
      for (const [id, g] of rects) {
        const { x1, x2, y1, y2 } = g.box;
        if (p.x >= x1 - HIT_PX && p.x <= x2 + HIT_PX && p.y >= y1 - HIT_PX && p.y <= y2 + HIT_PX) {
          return { id, type: "rectangle", anchor: null, locked: g.locked };
        }
      }
      for (const [id, g] of positionsGeo) {
        const top = Math.min(g.yTp, g.ySl);
        const bottom = Math.max(g.yTp, g.ySl);
        if (p.x >= g.x1 && p.x <= g.x2 && p.y >= top && p.y <= bottom) {
          return { id, type: "position", anchor: null, locked: g.locked };
        }
      }
      for (const [id, g] of entries) {
        const inX = p.x >= g.x1 - HIT_PX && p.x <= g.x2 + HIT_PX;
        const onLevel = inX && g.levels.some((l) => Math.abs(l.y - p.y) <= HIT_PX);
        const ys = g.levels.map((l) => l.y);
        const onBackground =
          g.background && ys.length > 1 && inX && p.y >= Math.min(...ys) && p.y <= Math.max(...ys);
        const onTrend = g.points.some(
          (a, i) => i > 0 && distToSegment(p, g.points[i - 1], a) <= HIT_PX,
        );
        if (onLevel || onBackground || onTrend) {
          return { id, type: "fib", anchor: null, locked: g.locked };
        }
      }
      return null;
    };

    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      trendStarted = false;
      if (e.button !== 0) return;
      if (toolRef.current === "trendLine") {
        // First press starts the line; with a line already started, the release finishes it
        const local = localPoint(e);
        const p = local && pointAtRef.current(local.x, local.y);
        if (!p || trendDraftRef.current) return;
        trendStarted = true;
        trendDraftRef.current = [p, p];
        setTrendDraft([p, p]);
        return;
      }
      if (toolRef.current !== "cursor") return;
      const local = localPoint(e);
      const hit = local && hitTest(local);
      if (!hit) return;
      const store = useChartStore.getState();
      store.selectFib(hit.id);
      const position = hit.type === "position" ? store.positions.find((q) => q.id === hit.id) : null;
      const orig =
        hit.type === "trend"
          ? store.trendLines.find((t) => t.id === hit.id)?.points
          : position
            ? positionAnchors(position)
            : hit.type === "elliott"
              ? store.elliotts.find((w) => w.id === hit.id)?.points
              : hit.type === "rectangle"
                ? store.rectangles.find((r) => r.id === hit.id)?.points
                : store.fibs.find((f) => f.id === hit.id)?.points;
      // Moving the whole drawing keeps its shape: only anchors snap
      const start = pointAtRef.current(local.x, local.y, false);
      if (!orig || hit.locked || !start) return;
      fibDragRef.current = {
        id: hit.id,
        type: hit.type,
        anchor: hit.anchor,
        start,
        orig,
        moved: false,
      };
    };

    // While dragging a drawing (or drawing a trend line) the chart must not
    // pan: it listens to mousedown
    const onMouseDown = (e: MouseEvent) => {
      if (fibDragRef.current || (toolRef.current === "trendLine" && localPoint(e))) {
        e.stopPropagation();
      }
    };

    const onUp = (e: PointerEvent) => {
      const kind = FIB_TOOLS[toolRef.current];
      const start = down;
      down = null;

      const drag = fibDragRef.current;
      if (drag) {
        fibDragRef.current = null;
        if (drag.moved && drag.points) {
          const store = useChartStore.getState();
          if (drag.type === "trend") store.updateTrendLine(drag.id, { points: drag.points });
          else if (drag.type === "position") store.updatePosition(drag.id, positionFromAnchors(drag.points));
          else if (drag.type === "elliott") store.updateElliott(drag.id, { points: drag.points });
          else if (drag.type === "rectangle") store.updateRectangle(drag.id, { points: drag.points });
          else store.updateFib(drag.id, { points: drag.points });
        }
        setFibDragPoints(null);
        return;
      }

      if (toolRef.current === "trendLine") {
        const started = trendStarted;
        trendStarted = false;
        const draft = trendDraftRef.current;
        const local = localPoint(e);
        const p = local && pointAtRef.current(local.x, local.y);
        if (!draft || !p || !start || e.button !== 0) return;
        // A plain click on the first point: wait for the second click
        const dragged = Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5;
        if (started && !dragged) return;
        if (p.time === draft[0].time && p.price === draft[0].price) return;
        const store = useChartStore.getState();
        store.addTrendLine([draft[0], p], symbolRef.current);
        store.setTool("cursor");
        trendDraftRef.current = null;
        setTrendDraft(null);
        return;
      }

      // Ignore drags (panning the chart) and non-left buttons
      if (!start || e.button !== 0) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) return;
      const local = localPoint(e);

      if (toolRef.current === "cursor") {
        // Click on empty chart space deselects
        if (!local || !hitTest(local)) useChartStore.getState().selectFib(null);
        return;
      }

      const side = POSITION_TOOLS[toolRef.current];
      if (side) {
        if (local) placePositionRef.current(side, local);
        return;
      }

      if (toolRef.current === "rectangle") {
        const p = local && pointAtRef.current(local.x, local.y);
        if (!p) return;
        const draft = rectDraftRef.current;
        if (!draft) {
          setRectDraft([p, p]);
          return;
        }
        const store = useChartStore.getState();
        store.addRectangle([draft[0], p], symbolRef.current);
        store.setTool("cursor");
        setRectDraft(null);
        return;
      }

      const waveKind = ELLIOTT_TOOLS[toolRef.current];
      if (waveKind) {
        const p = local && pointAtRef.current(local.x, local.y);
        if (!p) return;
        const draft = elliottDraftRef.current;
        if (!draft || draft.kind !== waveKind) {
          setElliottDraft({ kind: waveKind, points: [p, p] });
          return;
        }
        const fixed = [...draft.points.slice(0, -1), p];
        if (fixed.length >= ELLIOTT_POINT_COUNT[waveKind]) {
          const store = useChartStore.getState();
          store.addElliott(waveKind, fixed, symbolRef.current);
          store.setTool("cursor");
          setElliottDraft(null);
        } else {
          setElliottDraft({ kind: waveKind, points: [...fixed, p] });
        }
        return;
      }

      if (!kind) return;
      const p = local && pointAtRef.current(local.x, local.y);
      if (!p) return;
      const draft = fibDraftRef.current;
      if (!draft || draft.kind !== kind) {
        setFibDraft({ kind, points: [p, p] });
        return;
      }
      const fixed = [...draft.points.slice(0, -1), p];
      if (fixed.length >= FIB_POINT_COUNT[kind]) {
        const store = useChartStore.getState();
        store.addFib(kind, fixed, symbolRef.current);
        store.setTool("cursor");
        setFibDraft(null);
      } else {
        setFibDraft({ kind, points: [...fixed, p] });
      }
    };

    const onMove = (e: PointerEvent) => {
      const local = localPoint(e);
      const drag = fibDragRef.current;
      const placing = toolRef.current !== "cursor" || (drag !== null && drag.anchor !== null);
      updateSnapDotRef.current(placing ? local : null);
      if (drag) {
        const p = local && pointAtRef.current(local.x, local.y, drag.anchor !== null);
        if (!p) return;
        const points =
          drag.anchor === null
            ? drag.orig.map((q) => ({
                time: q.time + (p.time - drag.start.time),
                price: q.price + (p.price - drag.start.price),
              }))
            : drag.type === "position"
              ? dragPositionRef.current(drag.id, drag.orig, drag.anchor, p)
              : drag.orig.map((q, i) => (i === drag.anchor ? p : q));
        drag.moved = true;
        drag.points = points;
        setFibDragPoints({ id: drag.id, points });
        return;
      }
      if (toolRef.current === "cursor") {
        const hit = local && hitTest(local);
        el.style.cursor = !hit ? "" : hit.locked ? "pointer" : hit.anchor !== null ? "grab" : "move";
        return;
      }
      if (toolRef.current === "trendLine") {
        const p = local && pointAtRef.current(local.x, local.y);
        if (!p || !trendDraftRef.current) return;
        setTrendDraft((prev) => (prev ? [prev[0], p] : prev));
        return;
      }
      if (toolRef.current === "rectangle") {
        const p = local && pointAtRef.current(local.x, local.y);
        if (!p) return;
        setRectDraft((prev) => (prev ? [prev[0], p] : prev));
        return;
      }
      if (ELLIOTT_TOOLS[toolRef.current]) {
        const p = local && pointAtRef.current(local.x, local.y);
        if (!p || !elliottDraftRef.current) return;
        setElliottDraft((prev) =>
          prev ? { ...prev, points: [...prev.points.slice(0, -1), p] } : prev,
        );
        return;
      }
      if (!fibDraftRef.current) return;
      const p = local && pointAtRef.current(local.x, local.y);
      if (!p) return;
      setFibDraft((prev) =>
        prev ? { ...prev, points: [...prev.points.slice(0, -1), p] } : prev,
      );
    };

    const onLeave = () => updateSnapDotRef.current(null);

    // Double-click on a drawing opens its settings
    const onDblClick = (e: MouseEvent) => {
      if (toolRef.current !== "cursor") return;
      const local = localPoint(e);
      const hit = local && hitTest(local);
      if (!hit) return;
      e.stopPropagation();
      const store = useChartStore.getState();
      store.selectFib(hit.id);
      if (hit.type === "trend") store.setTrendSettingsTarget(hit.id);
      else if (hit.type === "position") store.setPositionSettingsTarget(hit.id);
      else if (hit.type === "rectangle") store.setRectangleSettingsTarget(hit.id);
      else if (hit.type === "fib") store.setFibSettingsTarget(hit.id);
    };

    // Right-click on a drawing selects it (shows its toolbar) instead of the browser menu
    const onContextMenu = (e: MouseEvent) => {
      const local = localPoint(e);
      const hit = local && hitTest(local);
      if (!hit) return;
      e.preventDefault();
      useChartStore.getState().selectFib(hit.id);
    };

    const onKey = (e: KeyboardEvent) => {
      const store = useChartStore.getState();
      const dialogOpen =
        !!store.fibSettingsTarget ||
        !!store.trendSettingsTarget ||
        !!store.positionSettingsTarget ||
        !!store.rectangleSettingsTarget;
      if (e.key === "Escape") {
        setFibDraft(null);
        setElliottDraft(null);
        rectDraftRef.current = null;
        setRectDraft(null);
        trendDraftRef.current = null;
        setTrendDraft(null);
        if (!dialogOpen) store.selectFib(null);
        return;
      }
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (store.selectedFibId && !dialogOpen) {
        e.preventDefault();
        // Ids are unique across all lists: only the owner removes anything
        store.removeFib(store.selectedFibId);
        store.removeTrendLine(store.selectedFibId);
        store.removePosition(store.selectedFibId);
        store.removeElliott(store.selectedFibId);
        store.removeRectangle(store.selectedFibId);
      }
    };

    // Capture phase: the chart's own handlers don't get a chance to stop them
    el.addEventListener("pointerdown", onDown, true);
    el.addEventListener("mousedown", onMouseDown, true);
    el.addEventListener("pointerup", onUp, true);
    el.addEventListener("pointermove", onMove, true);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("dblclick", onDblClick, true);
    el.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("pointerdown", onDown, true);
      el.removeEventListener("mousedown", onMouseDown, true);
      el.removeEventListener("pointerup", onUp, true);
      el.removeEventListener("pointermove", onMove, true);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("dblclick", onDblClick, true);
      el.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function updateEMAs() {
    const c = candlesRef.current;
    if (c.length === 0) return;
    const cfg = configRef.current;
    let last20: number | undefined;
    let last50: number | undefined;
    let last200: number | undefined;

    if (ema20Ref.current) {
      const data = ema(c, cfg.ema20);
      ema20Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last20 = data.at(-1)?.value;
    }
    if (ema50Ref.current) {
      const data = ema(c, cfg.ema50);
      ema50Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last50 = data.at(-1)?.value;
    }
    if (ema200Ref.current) {
      const data = ema(c, cfg.ema200);
      ema200Ref.current.setData(
        data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
      );
      last200 = data.at(-1)?.value;
    }
    const lastVol = c.at(-1)?.volume;
    setLastValues((prev) => ({
      ...prev,
      ema20: last20,
      ema50: last50,
      ema200: last200,
      volume: lastVol,
    }));
  }

  function updateRSI() {
    const c = candlesRef.current;
    if (c.length === 0 || !rsiRef.current) return;
    const cfg = configRef.current;
    const data = rsi(c, cfg.rsi).map((p) => ({
      time: p.time as UTCTimestamp,
      value: p.value,
    }));
    rsiRef.current.setData(data);
    if (rsi30Ref.current && data.length > 0)
      rsi30Ref.current.setData([
        { time: data[0].time, value: 30 },
        { time: data[data.length - 1].time, value: 30 },
      ]);
    if (rsi70Ref.current && data.length > 0)
      rsi70Ref.current.setData([
        { time: data[0].time, value: 70 },
        { time: data[data.length - 1].time, value: 70 },
      ]);
    setLastValues((prev) => ({ ...prev, rsi: data.at(-1)?.value }));
  }

  function updateMACD() {
    const c = candlesRef.current;
    if (c.length === 0 || !macdRef.current) return;
    const cfg = configRef.current;
    const m = macd(c, cfg.macdFast, cfg.macdSlow, cfg.macdSignal);
    macdRef.current.setData(
      m.map((p) => ({ time: p.time as UTCTimestamp, value: p.macd })),
    );
    macdSignalRef.current?.setData(
      m.map((p) => ({ time: p.time as UTCTimestamp, value: p.signal })),
    );
    macdHistRef.current?.setData(
      m.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.histogram,
        color: p.histogram >= 0 ? `${TV_COLORS.green}80` : `${TV_COLORS.red}80`,
      })),
    );
    const last = m.at(-1);
    setLastValues((prev) => ({
      ...prev,
      macd: last?.macd,
      macdSignal: last?.signal,
      macdHist: last?.histogram,
    }));
  }

  // Load historical data + subscribe live
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;

    async function load() {
      try {
        const klines = await fetchKlines(symbol, timeframe, 1000);
        if (cancelled) return;
        candlesRef.current = klines;
        if (candleSeriesRef.current) {
          candleSeriesRef.current.setData(
            klines.map((k) => ({
              time: k.time as UTCTimestamp,
              open: k.open,
              high: k.high,
              low: k.low,
              close: k.close,
            })),
          );
        }
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData(
            klines.map((k) => ({
              time: k.time as UTCTimestamp,
              value: k.volume,
              color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
            })),
          );
        }
        updateEMAs();
        updateRSI();
        updateMACD();
        chartRef.current?.timeScale().fitContent();
        requestAnimationFrame(() => recomputePaneOffsets());

        if (klines.length > 0) {
          const last = klines[klines.length - 1];
          const prev = klines[klines.length - 2] ?? last;
          setLastPrice({
            value: last.close,
            pct: prev.close === 0 ? 0 : ((last.close - prev.close) / prev.close) * 100,
          });
        }

        const ws = getBinanceWS();
        unsub = ws.subscribeKline({
          symbol,
          interval: timeframe,
          onCandle: (k) => {
            if (!candleSeriesRef.current) return;
            const arr = candlesRef.current;
            const lastCandle = arr[arr.length - 1];
            if (lastCandle && lastCandle.time === k.time) {
              arr[arr.length - 1] = k;
            } else if (!lastCandle || k.time > lastCandle.time) {
              arr.push(k);
              if (arr.length > 2000) arr.shift();
            } else {
              return;
            }
            candleSeriesRef.current.update({
              time: k.time as UTCTimestamp,
              open: k.open,
              high: k.high,
              low: k.low,
              close: k.close,
            });
            if (volumeSeriesRef.current) {
              volumeSeriesRef.current.update({
                time: k.time as UTCTimestamp,
                value: k.volume,
                color: k.close >= k.open ? `${TV_COLORS.green}66` : `${TV_COLORS.red}66`,
              });
            }
            updateEMAs();
            updateRSI();
            updateMACD();
            const prev = arr[arr.length - 2] ?? lastCandle;
            setLastPrice({
              value: k.close,
              pct: prev && prev.close !== 0 ? ((k.close - prev.close) / prev.close) * 100 : 0,
            });
          },
        });
      } catch (e) {
        console.error("Failed to load chart data:", e);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [symbol, timeframe]);

  const greenOrRed = (n: number) =>
    n >= 0 ? "text-tv-green" : "text-tv-red";

  // Helpers for pill rendering
  const isShown = (key: IndicatorKey) =>
    indicators[key] && (key === "volume" || true); // always renderable if enabled
  void isShown;

  // Determine which pane each indicator lives in (based on current layout)
  const rsiPaneIdx = 1;
  const macdPaneIdx = indicators.rsi ? 2 : 1;

  let measureRender: React.ReactNode = null;
  if (
    measure.a &&
    measure.b &&
    chartRef.current &&
    candleSeriesRef.current
  ) {
    const ts = chartRef.current.timeScale();
    const aX = ts.timeToCoordinate(measure.a.time as UTCTimestamp);
    const bX = ts.timeToCoordinate(measure.b.time as UTCTimestamp);
    const aY = candleSeriesRef.current.priceToCoordinate(measure.a.price);
    const bY = candleSeriesRef.current.priceToCoordinate(measure.b.price);

    if (aX !== null && bX !== null && aY !== null && bY !== null) {
      const priceDiff = measure.b.price - measure.a.price;
      const pctChange =
        measure.a.price === 0 ? 0 : (priceDiff / measure.a.price) * 100;
      const isUp = priceDiff >= 0;
      const start = Math.min(measure.a.time, measure.b.time);
      const end = Math.max(measure.a.time, measure.b.time);
      const inRange = candlesRef.current.filter(
        (c) => c.time >= start && c.time <= end,
      );
      const bars = inRange.length;
      const volume = inRange.reduce((s, c) => s + c.volume, 0);
      const dur = durationLabel(measure.a.time, measure.b.time);

      measureRender = (
        <MeasureOverlay
          aX={aX}
          aY={aY}
          bX={bX}
          bY={bY}
          priceDiff={priceDiff}
          pctChange={pctChange}
          bars={bars}
          volume={volume}
          durationText={dur}
          isUp={isUp}
          isPreview={measure.phase === "placing"}
        />
      );
    }
  }
  // Fibonacci drawings for this symbol + the one being placed
  const fibRender: React.ReactNode[] = [];
  let fibToolbar: React.ReactNode = null;
  const fibGeometry: typeof fibGeometryRef.current = new Map();
  if (chartRef.current && candleSeriesRef.current && paneOffsets[0]) {
    const series = candleSeriesRef.current;
    const areaWidth = chartRef.current.timeScale().width();
    const areaHeight = paneOffsets[0].height;
    const toDraw = fibs
      .filter((f) => f.symbol === symbol)
      .map((f) => ({
        key: f.id,
        kind: f.kind,
        points: fibDragPoints?.id === f.id ? fibDragPoints.points : f.points,
        settings: fibSettingsOf(f),
        locked: !!f.locked,
        isPreview: false,
      }));
    if (fibDraft) {
      toDraw.push({
        key: "draft",
        kind: fibDraft.kind,
        points: fibDraft.points,
        settings: fibDefaults[fibDraft.kind] ?? defaultFibSettings(fibDraft.kind),
        locked: false,
        isPreview: true,
      });
    }
    for (const f of toDraw) {
      const pts = f.points.flatMap((p) => {
        const x = timeToCoordinate(p.time);
        const y = series.priceToCoordinate(p.price);
        return x === null || y === null ? [] : [{ x, y }];
      });
      if (pts.length !== f.points.length) continue;
      // Extension levels need C: until then only the A→B line is shown
      const levels =
        f.kind === "extension" && f.points.length < 3
          ? []
          : fibLevels(f.kind, f.points, f.settings).flatMap((l) => {
              const y = series.priceToCoordinate(l.price);
              return y === null ? [] : [{ ...l, y }];
            });
      const geometry: FibGeometry = { points: pts, levels, ...fibSpan(pts, f.settings, areaWidth) };
      const selected = f.key === selectedFibId;
      if (!f.isPreview) {
        fibGeometry.set(f.key, { ...geometry, locked: f.locked, background: f.settings.background });
      }
      fibRender.push(
        <FibOverlay
          key={f.key}
          {...geometry}
          settings={f.settings}
          isPreview={f.isPreview}
          selected={selected}
          width={areaWidth}
          height={areaHeight}
        />,
      );
      if (selected) {
        const xs = pts.map((p) => p.x);
        const top = Math.min(...pts.map((p) => p.y), ...levels.map((l) => l.y));
        // Above the drawing; if that's off-screen (behind the header), below the anchors
        const toolbarY =
          top - 10 >= 90 ? top - 10 : Math.max(...pts.map((p) => p.y)) + 44;
        const id = f.key;
        const locked = f.locked;
        fibToolbar = (
          <FibToolbar
            x={Math.max(80, Math.min(areaWidth - 80, (Math.min(...xs) + Math.max(...xs)) / 2))}
            y={Math.max(40, Math.min(areaHeight - 4, toolbarY))}
            locked={locked}
            onSettings={() => useChartStore.getState().setFibSettingsTarget(id)}
            onToggleLock={() => useChartStore.getState().updateFib(id, { locked: !locked })}
            onClone={() => useChartStore.getState().cloneFib(id)}
            onRemove={() => useChartStore.getState().removeFib(id)}
          />
        );
      }
    }
  }
  fibGeometryRef.current = fibGeometry;

  // Trend lines for this symbol + the one being placed (drawn above fibs)
  const trendRender: React.ReactNode[] = [];
  const trendGeometry: typeof trendGeometryRef.current = new Map();
  if (chartRef.current && candleSeriesRef.current && paneOffsets[0]) {
    const series = candleSeriesRef.current;
    const areaWidth = chartRef.current.timeScale().width();
    const areaHeight = paneOffsets[0].height;
    const toDraw = trendLines
      .filter((t) => t.symbol === symbol)
      .map((t) => ({
        key: t.id,
        points: fibDragPoints?.id === t.id ? fibDragPoints.points : t.points,
        settings: trendLineSettingsOf(t.settings),
        locked: !!t.locked,
        isPreview: false,
      }));
    if (trendDraft) {
      toDraw.push({
        key: "trend-draft",
        points: trendDraft,
        settings: trendLineSettingsOf(trendLineDefaults ?? defaultTrendLineSettings()),
        locked: false,
        isPreview: true,
      });
    }
    for (const t of toDraw) {
      const pts = t.points.flatMap((p) => {
        const x = timeToCoordinate(p.time);
        const y = series.priceToCoordinate(p.price);
        return x === null || y === null ? [] : [{ x, y }];
      });
      if (pts.length !== 2) continue;
      const geometry: TrendGeometry = {
        points: pts,
        segment: trendSegment(pts[0], pts[1], t.settings, areaWidth, areaHeight),
      };
      if (!t.isPreview) trendGeometry.set(t.key, { ...geometry, locked: t.locked });

      let stats: string[] | null = null;
      if (t.settings.stats) {
        const [a, b] = t.points;
        const diff = b.price - a.price;
        const pct = a.price === 0 ? 0 : (diff / a.price) * 100;
        const bars = Math.round(Math.abs(b.time - a.time) / barSeconds(series.data()));
        const angle = (Math.atan2(pts[0].y - pts[1].y, pts[1].x - pts[0].x) * 180) / Math.PI;
        stats = [
          `${diff >= 0 ? "+" : ""}${formatPrice(diff)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`,
          `${bars} barras, ${durationLabel(a.time, b.time)}`,
          `Ángulo ${angle.toFixed(1)}°`,
        ];
      }

      const selected = t.key === selectedFibId;
      trendRender.push(
        <TrendLineOverlay
          key={t.key}
          {...geometry}
          settings={t.settings}
          prices={t.points.map((p) => p.price)}
          stats={stats}
          isPreview={t.isPreview}
          selected={selected}
          width={areaWidth}
          height={areaHeight}
        />,
      );
      if (selected) {
        const ys = pts.map((p) => p.y);
        const top = Math.min(...ys);
        // Above the line; if that's off-screen (behind the header), below it
        const toolbarY = top - 10 >= 90 ? top - 10 : Math.max(...ys) + 44;
        const id = t.key;
        const locked = t.locked;
        fibToolbar = (
          <FibToolbar
            x={Math.max(80, Math.min(areaWidth - 80, (pts[0].x + pts[1].x) / 2))}
            y={Math.max(40, Math.min(areaHeight - 4, toolbarY))}
            locked={locked}
            onSettings={() => useChartStore.getState().setTrendSettingsTarget(id)}
            onToggleLock={() => useChartStore.getState().updateTrendLine(id, { locked: !locked })}
            onClone={() => useChartStore.getState().cloneTrendLine(id)}
            onRemove={() => useChartStore.getState().removeTrendLine(id)}
          />
        );
      }
    }
  }
  trendGeometryRef.current = trendGeometry;

  // Long / short positions for this symbol (drawn above fibs, below trend lines)
  const positionRender: React.ReactNode[] = [];
  const positionGeometry: typeof positionGeometryRef.current = new Map();
  if (chartRef.current && candleSeriesRef.current && paneOffsets[0]) {
    const series = candleSeriesRef.current;
    const areaWidth = chartRef.current.timeScale().width();
    const areaHeight = paneOffsets[0].height;
    for (const pos of positions) {
      if (pos.symbol !== symbol) continue;
      const shape =
        fibDragPoints?.id === pos.id ? positionFromAnchors(fibDragPoints.points) : pos;
      const settings = positionSettingsOf(pos.settings);
      const x1 = timeToCoordinate(shape.entry.time);
      const x2 = timeToCoordinate(shape.endTime);
      const yEntry = series.priceToCoordinate(shape.entry.price);
      const yTp = series.priceToCoordinate(shape.tp);
      const ySl = series.priceToCoordinate(shape.sl);
      if (x1 === null || x2 === null || yEntry === null || yTp === null || ySl === null) continue;
      const geometry: PositionGeometry = {
        points: [
          { x: x1, y: yEntry },
          { x: x1, y: yTp },
          { x: x1, y: ySl },
          { x: x2, y: yEntry },
        ],
        x1,
        x2,
        yEntry,
        yTp,
        ySl,
      };
      positionGeometry.set(pos.id, { ...geometry, locked: !!pos.locked });

      const stats = positionStats(shape, settings);
      const outcome = positionOutcome(shape, pos.side, candlesRef.current);
      const dir = pos.side === "long" ? 1 : -1;
      let pnl: number | null = null;
      let trade: PositionTrade | null = null;
      if (outcome.openTime !== undefined && outcome.exitPrice !== undefined && outcome.exitTime !== undefined) {
        pnl = (outcome.exitPrice - shape.entry.price) * dir * stats.qty * settings.lotSize;
        const tx1 = timeToCoordinate(outcome.openTime);
        const tx2 = timeToCoordinate(outcome.exitTime);
        const yExit = series.priceToCoordinate(outcome.exitPrice);
        if (tx1 !== null && tx2 !== null && yExit !== null) {
          trade = { x1: tx1, x2: tx2, yExit, profit: pnl >= 0 };
        }
      }

      const selected = pos.id === selectedFibId;
      positionRender.push(
        <PositionOverlay
          key={pos.id}
          {...geometry}
          settings={settings}
          stats={stats}
          prices={{ tp: shape.tp, sl: shape.sl }}
          outcome={outcome}
          pnl={pnl}
          trade={trade}
          isPreview={false}
          selected={selected}
          width={areaWidth}
          height={areaHeight}
        />,
      );
      if (selected) {
        // Above the box and its top label; if that's off-screen, below the box
        const labelH = settings.showLabels ? settings.fontSize + 14 : 0;
        const top = Math.min(yTp, ySl) - labelH;
        const bottom = Math.max(yTp, ySl) + labelH;
        const toolbarY = top - 10 >= 90 ? top - 10 : bottom + 44;
        const id = pos.id;
        const locked = !!pos.locked;
        fibToolbar = (
          <FibToolbar
            x={Math.max(80, Math.min(areaWidth - 80, (x1 + x2) / 2))}
            y={Math.max(40, Math.min(areaHeight - 4, toolbarY))}
            locked={locked}
            onSettings={() => useChartStore.getState().setPositionSettingsTarget(id)}
            onToggleLock={() => useChartStore.getState().updatePosition(id, { locked: !locked })}
            onClone={() => useChartStore.getState().clonePosition(id)}
            onRemove={() => useChartStore.getState().removePosition(id)}
          />
        );
      }
    }
  }
  positionGeometryRef.current = positionGeometry;

  // Elliott waves for this symbol + the one being placed (drawn above fibs)
  const elliottRender: React.ReactNode[] = [];
  const elliottGeometry: typeof elliottGeometryRef.current = new Map();
  if (chartRef.current && candleSeriesRef.current && paneOffsets[0]) {
    const series = candleSeriesRef.current;
    const areaWidth = chartRef.current.timeScale().width();
    const areaHeight = paneOffsets[0].height;
    const toDraw = elliotts
      .filter((w) => w.symbol === symbol)
      .map((w) => ({
        key: w.id,
        kind: w.kind,
        points: fibDragPoints?.id === w.id ? fibDragPoints.points : w.points,
        color: w.color,
        locked: !!w.locked,
        isPreview: false,
      }));
    if (elliottDraft) {
      toDraw.push({
        key: "elliott-draft",
        kind: elliottDraft.kind,
        points: elliottDraft.points,
        color: ELLIOTT_COLORS[elliottDraft.kind],
        locked: false,
        isPreview: true,
      });
    }
    for (const w of toDraw) {
      const pts = w.points.flatMap((p) => {
        const x = timeToCoordinate(p.time);
        const y = series.priceToCoordinate(p.price);
        return x === null || y === null ? [] : [{ x, y }];
      });
      if (pts.length !== w.points.length) continue;
      if (!w.isPreview) elliottGeometry.set(w.key, { points: pts, locked: w.locked });

      const selected = w.key === selectedFibId;
      elliottRender.push(
        <ElliottOverlay
          key={w.key}
          kind={w.kind}
          color={w.color}
          points={pts}
          prices={w.points.map((p) => p.price)}
          isPreview={w.isPreview}
          selected={selected}
          width={areaWidth}
          height={areaHeight}
        />,
      );
      if (selected) {
        const ys = pts.map((p) => p.y);
        const xs = pts.map((p) => p.x);
        // Above the wave (and its labels); if that's off-screen, below it
        const top = Math.min(...ys) - 22;
        const toolbarY = top - 10 >= 90 ? top - 10 : Math.max(...ys) + 44;
        const id = w.key;
        const locked = w.locked;
        fibToolbar = (
          <FibToolbar
            x={Math.max(80, Math.min(areaWidth - 80, (Math.min(...xs) + Math.max(...xs)) / 2))}
            y={Math.max(40, Math.min(areaHeight - 4, toolbarY))}
            locked={locked}
            onToggleLock={() => useChartStore.getState().updateElliott(id, { locked: !locked })}
            onClone={() => useChartStore.getState().cloneElliott(id)}
            onRemove={() => useChartStore.getState().removeElliott(id)}
          />
        );
      }
    }
  }
  elliottGeometryRef.current = elliottGeometry;

  // Rectangles for this symbol + the one being placed
  const rectRender: React.ReactNode[] = [];
  const rectGeometry: typeof rectGeometryRef.current = new Map();
  if (chartRef.current && candleSeriesRef.current && paneOffsets[0]) {
    const series = candleSeriesRef.current;
    const areaWidth = chartRef.current.timeScale().width();
    const areaHeight = paneOffsets[0].height;
    const toDraw = rectangles
      .filter((r) => r.symbol === symbol)
      .map((r) => ({
        key: r.id,
        points: fibDragPoints?.id === r.id ? fibDragPoints.points : r.points,
        settings: rectangleSettingsOf(r),
        locked: !!r.locked,
        isPreview: false,
      }));
    if (rectDraft) {
      toDraw.push({
        key: "rect-draft",
        points: rectDraft,
        settings: rectangleSettingsOf({ settings: rectangleDefaults ?? defaultRectangleSettings() }),
        locked: false,
        isPreview: true,
      });
    }
    for (const r of toDraw) {
      const pts = r.points.flatMap((p) => {
        const x = timeToCoordinate(p.time);
        const y = series.priceToCoordinate(p.price);
        return x === null || y === null ? [] : [{ x, y }];
      });
      if (pts.length !== r.points.length) continue;
      const box = rectangleBox(pts[0], pts[1], r.settings, areaWidth);
      if (!r.isPreview) rectGeometry.set(r.key, { points: pts, box, locked: r.locked });

      const selected = r.key === selectedFibId;
      rectRender.push(
        <RectangleOverlay
          key={r.key}
          settings={r.settings}
          points={pts}
          box={box}
          prices={r.points.map((p) => p.price)}
          isPreview={r.isPreview}
          selected={selected}
          width={areaWidth}
          height={areaHeight}
        />,
      );
      if (selected) {
        const top = box.y1 - 12;
        const toolbarY = top >= 90 ? top : box.y2 + 44;
        const id = r.key;
        const locked = r.locked;
        fibToolbar = (
          <FibToolbar
            x={Math.max(80, Math.min(areaWidth - 80, (box.x1 + box.x2) / 2))}
            y={Math.max(40, Math.min(areaHeight - 4, toolbarY))}
            locked={locked}
            onSettings={() => useChartStore.getState().setRectangleSettingsTarget(id)}
            onToggleLock={() => useChartStore.getState().updateRectangle(id, { locked: !locked })}
            onClone={() => useChartStore.getState().cloneRectangle(id)}
            onRemove={() => useChartStore.getState().removeRectangle(id)}
          />
        );
      }
    }
  }
  rectGeometryRef.current = rectGeometry;
  void renderTick;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {measureRender}
      {fibRender}
      {positionRender}
      {rectRender}
      {elliottRender}
      {trendRender}
      {snapDot && (
        <div
          className="pointer-events-none absolute z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-tv-blue bg-tv-bg"
          style={{ left: snapDot.x, top: snapDot.y }}
        />
      )}
      {fibToolbar}

      {/* Top-left of main pane: symbol info + OHLC + Volume pill + EMA pills */}
      <div
        style={{ top: (paneOffsets[0]?.top ?? 0) + 12, left: 12 }}
        className="pointer-events-none absolute z-10 flex flex-col gap-1 text-xs tabular-nums"
      >
        {/* Row 1: symbol info + OHLC stats inline on hover (fixed height, never wraps) */}
        <div className="flex h-5 flex-nowrap items-center gap-x-3 overflow-hidden whitespace-nowrap">
          <div className="flex shrink-0 items-center gap-2 text-[13px] font-semibold">
            <span className="text-tv-text">{symbol}</span>
            <span className="text-tv-text-muted">·</span>
            <span className="uppercase text-tv-text-muted">{timeframe}</span>
            <span className="text-tv-text-muted">·</span>
            <span className="text-tv-text-muted">Binance</span>
          </div>
          {hover && (
            <div className="flex items-center gap-x-3 text-[11px]">
              <span className="text-tv-text-muted">
                O <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.o)}</span>
              </span>
              <span className="text-tv-text-muted">
                H <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.h)}</span>
              </span>
              <span className="text-tv-text-muted">
                L <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.l)}</span>
              </span>
              <span className="text-tv-text-muted">
                C <span className={greenOrRed(hover.c - hover.o)}>{formatPrice(hover.c)}</span>
              </span>
              <span className={greenOrRed(hover.pct)}>
                {hover.pct >= 0 ? "+" : ""}
                {hover.pct.toFixed(2)}%
              </span>
              <span className="text-tv-text-muted">
                Vol <span className="text-tv-text">{formatVolume(hover.v)}</span>
              </span>
            </div>
          )}
        </div>

        {/* Row 2: big live price (always present — reserves space even while loading) */}
        <div className="flex h-7 items-center gap-2">
          {lastPrice ? (
            <>
              <span className={`text-lg font-semibold tabular-nums ${greenOrRed(lastPrice.pct)}`}>
                {formatPrice(lastPrice.value)}
              </span>
              <span className={`text-xs ${greenOrRed(lastPrice.pct)}`}>
                {lastPrice.pct >= 0 ? "+" : ""}
                {lastPrice.pct.toFixed(2)}%
              </span>
            </>
          ) : (
            <span className="text-xs text-tv-text-muted">Cargando…</span>
          )}
        </div>

        {/* Indicator pills for the main pane (fixed position below price) */}
        <div className="mt-1 flex flex-col items-start gap-1">
          {indicators.ema20 && (
            <IndicatorPill
              name={`EMA ${config.ema20}`}
              value={lastValues.ema20 !== undefined ? formatPrice(lastValues.ema20) : undefined}
              color={INDICATOR_COLORS.ema20}
              hidden={hidden.ema20}
              onToggleHide={() => toggleHidden("ema20")}
              onSettings={() => setSettingsTarget("ema20")}
              onRemove={() => removeIndicator("ema20")}
            />
          )}
          {indicators.ema50 && (
            <IndicatorPill
              name={`EMA ${config.ema50}`}
              value={lastValues.ema50 !== undefined ? formatPrice(lastValues.ema50) : undefined}
              color={INDICATOR_COLORS.ema50}
              hidden={hidden.ema50}
              onToggleHide={() => toggleHidden("ema50")}
              onSettings={() => setSettingsTarget("ema50")}
              onRemove={() => removeIndicator("ema50")}
            />
          )}
          {indicators.ema200 && (
            <IndicatorPill
              name={`EMA ${config.ema200}`}
              value={lastValues.ema200 !== undefined ? formatPrice(lastValues.ema200) : undefined}
              color={INDICATOR_COLORS.ema200}
              hidden={hidden.ema200}
              onToggleHide={() => toggleHidden("ema200")}
              onSettings={() => setSettingsTarget("ema200")}
              onRemove={() => removeIndicator("ema200")}
            />
          )}
          {indicators.volume && (
            <IndicatorPill
              name="Vol"
              value={lastValues.volume !== undefined ? formatVolume(lastValues.volume) : undefined}
              color={INDICATOR_COLORS.volume}
              hidden={hidden.volume}
              onToggleHide={() => toggleHidden("volume")}
              onSettings={() => setSettingsTarget("volume")}
              onRemove={() => removeIndicator("volume")}
            />
          )}
        </div>
      </div>

      {/* RSI pane label */}
      {indicators.rsi && paneOffsets[rsiPaneIdx] && (
        <div
          style={{ top: paneOffsets[rsiPaneIdx].top + 6, left: 12 }}
          className="pointer-events-none absolute z-10"
        >
          <IndicatorPill
            name={`RSI ${config.rsi}`}
            value={lastValues.rsi !== undefined ? lastValues.rsi.toFixed(2) : undefined}
            color={INDICATOR_COLORS.rsi}
            hidden={hidden.rsi}
            onToggleHide={() => toggleHidden("rsi")}
            onSettings={() => setSettingsTarget("rsi")}
            onRemove={() => removeIndicator("rsi")}
          />
        </div>
      )}

      {/* MACD pane label */}
      {indicators.macd && paneOffsets[macdPaneIdx] && (
        <div
          style={{ top: paneOffsets[macdPaneIdx].top + 6, left: 12 }}
          className="pointer-events-none absolute z-10"
        >
          <IndicatorPill
            name={`MACD ${config.macdFast}, ${config.macdSlow}, ${config.macdSignal}`}
            value={
              lastValues.macd !== undefined
                ? `${lastValues.macd.toFixed(2)} / ${(lastValues.macdSignal ?? 0).toFixed(2)}`
                : undefined
            }
            color={INDICATOR_COLORS.macd}
            hidden={hidden.macd}
            onToggleHide={() => toggleHidden("macd")}
            onSettings={() => setSettingsTarget("macd")}
            onRemove={() => removeIndicator("macd")}
          />
        </div>
      )}
    </div>
  );
}
