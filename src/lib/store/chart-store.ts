"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Timeframe } from "@/lib/binance/types";
import {
  cloneFibSettings,
  defaultFibSettings,
  migrateOldFibSettings,
  type FibSettings,
} from "@/lib/fibonacci";
import { defaultTrendLineSettings, type TrendLineSettings } from "@/lib/trendline";
import {
  defaultPositionSettings,
  type PositionSettings,
  type PositionShape,
  type PositionSide,
} from "@/lib/position";
import { ELLIOTT_COLORS, type ElliottKind } from "@/lib/elliott";
import { RECTANGLE_COLOR } from "@/lib/rectangle";

export type IndicatorKey =
  | "ema20"
  | "ema50"
  | "ema200"
  | "rsi"
  | "macd"
  | "volume";

export type DrawingTool =
  | "cursor"
  | "hline"
  | "measure"
  | "trendLine"
  | "fibRetracement"
  | "fibExtension"
  | "longPosition"
  | "shortPosition"
  | "elliottImpulse"
  | "elliottCorrection"
  | "rectangle"
  | "eraser";

/** Weak snaps only near an O/H/L/C; strong always snaps to the closest one */
export type MagnetMode = "weak" | "strong";

export interface PriceLine {
  id: string;
  symbol: string;
  price: number;
}

export type FibKind = "retracement" | "extension";

export interface FibPoint {
  time: number;
  price: number;
}

export interface FibDrawing {
  id: string;
  symbol: string;
  kind: FibKind;
  /** retracement: [A, B] · extension: [A, B, C] */
  points: FibPoint[];
  /** Missing on drawings saved before settings existed → defaults */
  settings?: FibSettings;
  /** Locked drawings can be selected but not moved */
  locked?: boolean;
}

export interface TrendLineDrawing {
  id: string;
  symbol: string;
  /** [A, B] */
  points: FibPoint[];
  settings: TrendLineSettings;
  locked?: boolean;
}

export interface PositionDrawing extends PositionShape {
  id: string;
  symbol: string;
  side: PositionSide;
  settings: PositionSettings;
  locked?: boolean;
}

export interface ElliottDrawing {
  id: string;
  symbol: string;
  kind: ElliottKind;
  /** impulse: [0, 1, 2, 3, 4, 5] · correction: [0, A, B, C] */
  points: FibPoint[];
  color: string;
  locked?: boolean;
}

export interface RectangleDrawing {
  id: string;
  symbol: string;
  /** Two opposite corners */
  points: FibPoint[];
  color: string;
  locked?: boolean;
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export interface IndicatorConfig {
  ema20: number;
  ema50: number;
  ema200: number;
  rsi: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
}

export const DEFAULT_CONFIG: IndicatorConfig = {
  ema20: 20,
  ema50: 50,
  ema200: 200,
  rsi: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
};

export const INDICATOR_COLORS: Record<IndicatorKey, string> = {
  ema20: "#ffb74d",
  ema50: "#2962ff",
  ema200: "#ab47bc",
  rsi: "#ab47bc",
  macd: "#2962ff",
  volume: "#787b86",
};

export const DEFAULT_WATCHLIST = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "MATICUSDT",
];

interface ChartState {
  symbol: string;
  timeframe: Timeframe;
  /** Indicator is added to the chart (appears in pill + renders unless hidden) */
  indicators: Record<IndicatorKey, boolean>;
  /** Indicator is hidden (eye icon off) — kept in pill list, just not rendered */
  hidden: Record<IndicatorKey, boolean>;
  /** Periods and parameters for each indicator */
  config: IndicatorConfig;
  watchlist: string[];
  /** Fibonacci drawings (persisted, filtered by symbol when rendering) */
  fibs: FibDrawing[];
  /** Style new Fibonacci drawings start with ("Guardar como predeterminado") */
  fibDefaults: Partial<Record<FibKind, FibSettings>>;
  /** Trend lines (persisted, filtered by symbol when rendering) */
  trendLines: TrendLineDrawing[];
  /** Style new trend lines start with (null = TradingView defaults) */
  trendLineDefaults: TrendLineSettings | null;
  /** Long / short positions (persisted, filtered by symbol when rendering) */
  positions: PositionDrawing[];
  /** Inputs and style new positions start with (null = TradingView defaults) */
  positionDefaults: PositionSettings | null;
  /** Elliott impulse / correction waves (persisted, filtered by symbol when rendering) */
  elliotts: ElliottDrawing[];
  /** Rectangles (persisted, filtered by symbol when rendering) */
  rectangles: RectangleDrawing[];
  /** Magnet: drawing points snap to the OHLC of the bar under the cursor */
  magnet: boolean;
  magnetMode: MagnetMode;

  // Ephemeral UI state (not persisted)
  tool: DrawingTool;
  priceLines: PriceLine[];
  symbolDialogOpen: boolean;
  /** Which indicator's settings dialog is open (null = closed) */
  settingsTarget: IndicatorKey | null;
  /** Selected drawing: a fib, trend line, position, Elliott wave or rectangle (ids never collide) */
  selectedFibId: string | null;
  /** Fib whose settings dialog is open (null = closed) */
  fibSettingsTarget: string | null;
  /** Trend line whose settings dialog is open (null = closed) */
  trendSettingsTarget: string | null;
  /** Position whose settings dialog is open (null = closed) */
  positionSettingsTarget: string | null;

  // Actions
  setSymbol: (s: string) => void;
  setTimeframe: (t: Timeframe) => void;
  toggleIndicator: (key: IndicatorKey) => void;
  removeIndicator: (key: IndicatorKey) => void;
  toggleHidden: (key: IndicatorKey) => void;
  setConfig: (patch: Partial<IndicatorConfig>) => void;
  addToWatchlist: (s: string) => void;
  removeFromWatchlist: (s: string) => void;
  setTool: (t: DrawingTool) => void;
  addPriceLine: (price: number, symbol: string) => void;
  clearPriceLines: (symbol?: string) => void;
  addFib: (kind: FibKind, points: FibPoint[], symbol: string) => void;
  clearFibs: (symbol?: string) => void;
  updateFib: (id: string, patch: Partial<Omit<FibDrawing, "id">>) => void;
  removeFib: (id: string) => void;
  cloneFib: (id: string) => void;
  selectFib: (id: string | null) => void;
  setFibSettingsTarget: (id: string | null) => void;
  setFibDefaults: (kind: FibKind, settings: FibSettings | null) => void;
  addTrendLine: (points: FibPoint[], symbol: string) => void;
  clearTrendLines: (symbol?: string) => void;
  updateTrendLine: (id: string, patch: Partial<Omit<TrendLineDrawing, "id">>) => void;
  removeTrendLine: (id: string) => void;
  cloneTrendLine: (id: string) => void;
  setTrendSettingsTarget: (id: string | null) => void;
  setTrendLineDefaults: (settings: TrendLineSettings | null) => void;
  /** Adds the position and selects it, like TradingView */
  addPosition: (side: PositionSide, shape: PositionShape, symbol: string) => void;
  clearPositions: (symbol?: string) => void;
  updatePosition: (id: string, patch: Partial<Omit<PositionDrawing, "id">>) => void;
  removePosition: (id: string) => void;
  clonePosition: (id: string) => void;
  setPositionSettingsTarget: (id: string | null) => void;
  setPositionDefaults: (settings: PositionSettings | null) => void;
  /** Adds the wave and selects it, like TradingView */
  addElliott: (kind: ElliottKind, points: FibPoint[], symbol: string) => void;
  clearElliotts: (symbol?: string) => void;
  updateElliott: (id: string, patch: Partial<Omit<ElliottDrawing, "id">>) => void;
  removeElliott: (id: string) => void;
  cloneElliott: (id: string) => void;
  addRectangle: (points: FibPoint[], symbol: string) => void;
  clearRectangles: (symbol?: string) => void;
  updateRectangle: (id: string, patch: Partial<Omit<RectangleDrawing, "id">>) => void;
  removeRectangle: (id: string) => void;
  cloneRectangle: (id: string) => void;
  setMagnet: (on: boolean) => void;
  /** Picking a mode also turns the magnet on, like TradingView */
  setMagnetMode: (mode: MagnetMode) => void;
  setSymbolDialogOpen: (v: boolean) => void;
  setSettingsTarget: (k: IndicatorKey | null) => void;
}

export const useChartStore = create<ChartState>()(
  persist(
    (set) => ({
      symbol: "BTCUSDT",
      timeframe: "15m" as Timeframe,
      indicators: {
        ema20: true,
        ema50: true,
        ema200: false,
        rsi: true,
        macd: false,
        volume: true,
      },
      hidden: {
        ema20: false,
        ema50: false,
        ema200: false,
        rsi: false,
        macd: false,
        volume: false,
      },
      config: { ...DEFAULT_CONFIG },
      watchlist: DEFAULT_WATCHLIST,
      fibs: [],
      fibDefaults: {},
      trendLines: [],
      trendLineDefaults: null,
      positions: [],
      positionDefaults: null,
      elliotts: [],
      rectangles: [],
      magnet: false,
      magnetMode: "weak",
      tool: "cursor",
      priceLines: [],
      symbolDialogOpen: false,
      settingsTarget: null,
      selectedFibId: null,
      fibSettingsTarget: null,
      trendSettingsTarget: null,
      positionSettingsTarget: null,

      setSymbol: (symbol) => set({ symbol }),
      setTimeframe: (timeframe) => set({ timeframe }),
      toggleIndicator: (key) =>
        set((s) => ({
          indicators: { ...s.indicators, [key]: !s.indicators[key] },
          // When re-adding, ensure not hidden
          hidden: !s.indicators[key]
            ? { ...s.hidden, [key]: false }
            : s.hidden,
        })),
      removeIndicator: (key) =>
        set((s) => ({
          indicators: { ...s.indicators, [key]: false },
          hidden: { ...s.hidden, [key]: false },
        })),
      toggleHidden: (key) =>
        set((s) => ({ hidden: { ...s.hidden, [key]: !s.hidden[key] } })),
      setConfig: (patch) =>
        set((s) => ({ config: { ...s.config, ...patch } })),
      addToWatchlist: (s) =>
        set((state) => ({
          watchlist: state.watchlist.includes(s)
            ? state.watchlist
            : [...state.watchlist, s],
        })),
      removeFromWatchlist: (s) =>
        set((state) => ({
          watchlist: state.watchlist.filter((x) => x !== s),
        })),
      setTool: (tool) => set({ tool }),
      addPriceLine: (price, symbol) =>
        set((state) => ({
          priceLines: [
            ...state.priceLines,
            { id: newId(), symbol, price },
          ],
        })),
      clearPriceLines: (symbol) =>
        set((state) => ({
          priceLines: symbol
            ? state.priceLines.filter((p) => p.symbol !== symbol)
            : [],
        })),
      addFib: (kind, points, symbol) =>
        set((state) => ({
          fibs: [
            ...state.fibs,
            {
              id: newId(),
              symbol,
              kind,
              points,
              settings: cloneFibSettings(state.fibDefaults[kind] ?? defaultFibSettings(kind)),
            },
          ],
        })),
      clearFibs: (symbol) =>
        set((state) => ({
          fibs: symbol ? state.fibs.filter((f) => f.symbol !== symbol) : [],
          selectedFibId: null,
          fibSettingsTarget: null,
        })),
      updateFib: (id, patch) =>
        set((state) => ({
          fibs: state.fibs.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        })),
      removeFib: (id) =>
        set((state) => ({
          fibs: state.fibs.filter((f) => f.id !== id),
          selectedFibId: state.selectedFibId === id ? null : state.selectedFibId,
          fibSettingsTarget: state.fibSettingsTarget === id ? null : state.fibSettingsTarget,
        })),
      cloneFib: (id) =>
        set((state) => {
          const src = state.fibs.find((f) => f.id === id);
          if (!src) return {};
          const copy: FibDrawing = {
            ...src,
            id: newId(),
            points: src.points.map((p) => ({ ...p })),
            settings: src.settings && cloneFibSettings(src.settings),
            locked: false,
          };
          return { fibs: [...state.fibs, copy], selectedFibId: copy.id };
        }),
      selectFib: (selectedFibId) => set({ selectedFibId }),
      setFibSettingsTarget: (fibSettingsTarget) => set({ fibSettingsTarget }),
      setFibDefaults: (kind, settings) =>
        set((state) => {
          const fibDefaults = { ...state.fibDefaults };
          if (settings) fibDefaults[kind] = cloneFibSettings(settings);
          else delete fibDefaults[kind];
          return { fibDefaults };
        }),
      addTrendLine: (points, symbol) =>
        set((state) => ({
          trendLines: [
            ...state.trendLines,
            {
              id: newId(),
              symbol,
              points,
              settings: { ...(state.trendLineDefaults ?? defaultTrendLineSettings()) },
            },
          ],
        })),
      clearTrendLines: (symbol) =>
        set((state) => ({
          trendLines: symbol ? state.trendLines.filter((t) => t.symbol !== symbol) : [],
          selectedFibId: null,
          trendSettingsTarget: null,
        })),
      updateTrendLine: (id, patch) =>
        set((state) => ({
          trendLines: state.trendLines.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      removeTrendLine: (id) =>
        set((state) => ({
          trendLines: state.trendLines.filter((t) => t.id !== id),
          selectedFibId: state.selectedFibId === id ? null : state.selectedFibId,
          trendSettingsTarget: state.trendSettingsTarget === id ? null : state.trendSettingsTarget,
        })),
      cloneTrendLine: (id) =>
        set((state) => {
          const src = state.trendLines.find((t) => t.id === id);
          if (!src) return {};
          const copy: TrendLineDrawing = {
            ...src,
            id: newId(),
            points: src.points.map((p) => ({ ...p })),
            settings: { ...src.settings },
            locked: false,
          };
          return { trendLines: [...state.trendLines, copy], selectedFibId: copy.id };
        }),
      setTrendSettingsTarget: (trendSettingsTarget) => set({ trendSettingsTarget }),
      setTrendLineDefaults: (settings) =>
        set({ trendLineDefaults: settings && { ...settings } }),
      addPosition: (side, shape, symbol) =>
        set((state) => {
          const id = newId();
          const position: PositionDrawing = {
            id,
            symbol,
            side,
            ...shape,
            settings: { ...(state.positionDefaults ?? defaultPositionSettings()) },
          };
          return { positions: [...state.positions, position], selectedFibId: id };
        }),
      clearPositions: (symbol) =>
        set((state) => ({
          positions: symbol ? state.positions.filter((p) => p.symbol !== symbol) : [],
          selectedFibId: null,
          positionSettingsTarget: null,
        })),
      updatePosition: (id, patch) =>
        set((state) => ({
          positions: state.positions.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      removePosition: (id) =>
        set((state) => ({
          positions: state.positions.filter((p) => p.id !== id),
          selectedFibId: state.selectedFibId === id ? null : state.selectedFibId,
          positionSettingsTarget:
            state.positionSettingsTarget === id ? null : state.positionSettingsTarget,
        })),
      clonePosition: (id) =>
        set((state) => {
          const src = state.positions.find((p) => p.id === id);
          if (!src) return {};
          const copy: PositionDrawing = {
            ...src,
            id: newId(),
            entry: { ...src.entry },
            settings: { ...src.settings },
            locked: false,
          };
          return { positions: [...state.positions, copy], selectedFibId: copy.id };
        }),
      setPositionSettingsTarget: (positionSettingsTarget) => set({ positionSettingsTarget }),
      setPositionDefaults: (settings) => set({ positionDefaults: settings && { ...settings } }),
      addElliott: (kind, points, symbol) =>
        set((state) => {
          const id = newId();
          const wave: ElliottDrawing = { id, symbol, kind, points, color: ELLIOTT_COLORS[kind] };
          return { elliotts: [...state.elliotts, wave], selectedFibId: id };
        }),
      clearElliotts: (symbol) =>
        set((state) => ({
          elliotts: symbol ? state.elliotts.filter((w) => w.symbol !== symbol) : [],
          selectedFibId: null,
        })),
      updateElliott: (id, patch) =>
        set((state) => ({
          elliotts: state.elliotts.map((w) => (w.id === id ? { ...w, ...patch } : w)),
        })),
      removeElliott: (id) =>
        set((state) => ({
          elliotts: state.elliotts.filter((w) => w.id !== id),
          selectedFibId: state.selectedFibId === id ? null : state.selectedFibId,
        })),
      cloneElliott: (id) =>
        set((state) => {
          const src = state.elliotts.find((w) => w.id === id);
          if (!src) return {};
          const copy: ElliottDrawing = {
            ...src,
            id: newId(),
            points: src.points.map((p) => ({ ...p })),
            locked: false,
          };
          return { elliotts: [...state.elliotts, copy], selectedFibId: copy.id };
        }),
      addRectangle: (points, symbol) =>
        set((state) => {
          const id = newId();
          const rect: RectangleDrawing = { id, symbol, points, color: RECTANGLE_COLOR };
          return { rectangles: [...state.rectangles, rect], selectedFibId: id };
        }),
      clearRectangles: (symbol) =>
        set((state) => ({
          rectangles: symbol ? state.rectangles.filter((r) => r.symbol !== symbol) : [],
          selectedFibId: null,
        })),
      updateRectangle: (id, patch) =>
        set((state) => ({
          rectangles: state.rectangles.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      removeRectangle: (id) =>
        set((state) => ({
          rectangles: state.rectangles.filter((r) => r.id !== id),
          selectedFibId: state.selectedFibId === id ? null : state.selectedFibId,
        })),
      cloneRectangle: (id) =>
        set((state) => {
          const src = state.rectangles.find((r) => r.id === id);
          if (!src) return {};
          const copy: RectangleDrawing = {
            ...src,
            id: newId(),
            points: src.points.map((p) => ({ ...p })),
            locked: false,
          };
          return { rectangles: [...state.rectangles, copy], selectedFibId: copy.id };
        }),
      setMagnet: (magnet) => set({ magnet }),
      setMagnetMode: (magnetMode) => set({ magnetMode, magnet: true }),
      setSymbolDialogOpen: (symbolDialogOpen) => set({ symbolDialogOpen }),
      setSettingsTarget: (settingsTarget) => set({ settingsTarget }),
    }),
    {
      name: "tv-gratis-chart-state",
      // v1: retracement defaults match TradingView's 24 levels
      // v2: retracement uses the user's own setup (10% levels, see fibonacci.ts)
      // v3: retracement 100% is the first click, 0% the second (not reversed)
      version: 3,
      migrate: (persisted, version) => {
        const s = persisted as Partial<ChartState>;
        if (version === 2) {
          s.fibs = s.fibs?.map((f) =>
            f.kind === "retracement" && f.settings
              ? { ...f, settings: { ...f.settings, reverse: false } }
              : f,
          );
          if (s.fibDefaults?.retracement) {
            s.fibDefaults = {
              ...s.fibDefaults,
              retracement: { ...s.fibDefaults.retracement, reverse: false },
            };
          }
          return s as ChartState;
        }
        if (version < 2) {
          // Existing retracements and any saved retracement default switch to it
          s.fibs = s.fibs?.map((f) =>
            f.kind === "retracement" ? { ...f, settings: defaultFibSettings("retracement") } : f,
          );
          if (s.fibDefaults?.retracement) {
            const rest = { ...s.fibDefaults };
            delete rest.retracement;
            s.fibDefaults = rest;
          }
          return s as ChartState;
        }
        if (version < 1) {
          s.fibs = s.fibs?.map((f) =>
            f.kind === "retracement" && f.settings
              ? { ...f, settings: migrateOldFibSettings(f.settings) }
              : f,
          );
          if (s.fibDefaults?.retracement) {
            s.fibDefaults = {
              ...s.fibDefaults,
              retracement: migrateOldFibSettings(s.fibDefaults.retracement),
            };
          }
        }
        return s as ChartState;
      },
      partialize: (s) => ({
        symbol: s.symbol,
        timeframe: s.timeframe,
        indicators: s.indicators,
        hidden: s.hidden,
        config: s.config,
        watchlist: s.watchlist,
        fibs: s.fibs,
        fibDefaults: s.fibDefaults,
        trendLines: s.trendLines,
        trendLineDefaults: s.trendLineDefaults,
        positions: s.positions,
        positionDefaults: s.positionDefaults,
        elliotts: s.elliotts,
        rectangles: s.rectangles,
        magnet: s.magnet,
        magnetMode: s.magnetMode,
      }),
    },
  ),
);
