"use client";

import { formatPrice } from "@/lib/format";
import type { PositionOutcome, PositionSettings, PositionStats } from "@/lib/position";

interface Px {
  x: number;
  y: number;
}

/** Pixel layout of one position — shared by the overlay and hit-testing */
export interface PositionGeometry {
  /** Handles: entry, target, stop (left edge) and width (right edge) */
  points: Px[];
  x1: number;
  x2: number;
  yEntry: number;
  yTp: number;
  ySl: number;
}

/** Part of the box price actually travelled: entry → exit / last price */
export interface PositionTrade {
  x1: number;
  x2: number;
  yExit: number;
  profit: boolean;
}

interface Props extends PositionGeometry {
  settings: PositionSettings;
  stats: PositionStats;
  prices: { tp: number; sl: number };
  outcome: PositionOutcome;
  /** P&L of the trade so far (null = price never reached the entry) */
  pnl: number | null;
  trade: PositionTrade | null;
  isPreview: boolean;
  selected: boolean;
  width: number;
  height: number;
}

const fmt = (n: number) => formatPrice(n);
const signed = (n: number) => `${n >= 0 ? "" : "-"}${fmt(Math.abs(n))}`;
const qtyText = (n: number) =>
  n >= 100 ? n.toFixed(0) : n >= 1 ? n.toFixed(2) : n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");

/** Filled label box centered on `x`, above (`dir` -1), below (+1) or centered on (0) `y` */
function Label({
  x,
  y,
  dir,
  lines,
  fill,
  color,
  fontSize,
}: {
  x: number;
  y: number;
  dir: -1 | 0 | 1;
  lines: string[];
  fill: string;
  color: string;
  fontSize: number;
}) {
  const lineH = fontSize + 4;
  const w = Math.max(...lines.map((l) => l.length)) * fontSize * 0.58 + 14;
  const h = lines.length * lineH + 6;
  const top = dir < 0 ? y - 4 - h : dir > 0 ? y + 4 : y - h / 2;
  return (
    <g>
      <rect x={x - w / 2} y={top} width={w} height={h} rx={3} fill={fill} />
      {lines.map((l, i) => (
        <text
          key={i}
          x={x}
          y={top + 3 + lineH * i + fontSize}
          textAnchor="middle"
          fill={color}
          fontSize={fontSize}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {l}
        </text>
      ))}
    </g>
  );
}

export function PositionOverlay({
  points,
  x1,
  x2,
  yEntry,
  yTp,
  ySl,
  settings,
  stats,
  prices,
  outcome,
  pnl,
  trade,
  isPreview,
  selected,
  width,
  height,
}: Props) {
  const fill = settings.opacity / 100;
  const cx = (x1 + x2) / 2;
  const w = Math.max(1, x2 - x1);
  // Labels go on the far side of each level, away from the entry
  const tpDir = yTp < yEntry ? -1 : 1;
  const slDir = ySl < yEntry ? -1 : 1;

  const targetLines = settings.compactStats
    ? [`${stats.targetPct.toFixed(2)}% · ${fmt(stats.targetAmount)}`]
    : [
        `Objetivo: ${fmt(prices.tp)} (${stats.targetPct.toFixed(2)}%), Importe: ${fmt(stats.targetAmount)}`,
      ];
  const stopLines = settings.compactStats
    ? [`${stats.stopPct.toFixed(2)}% · ${fmt(stats.stopAmount)}`]
    : [`Stop: ${fmt(prices.sl)} (${stats.stopPct.toFixed(2)}%), Importe: ${fmt(stats.stopAmount)}`];

  const state = outcome.status === "target" || outcome.status === "stop" ? "Cerrada" : "Abierta";
  const pnlText = pnl === null ? null : `${state} P&L: ${signed(pnl)}`;
  const centerLines = settings.compactStats
    ? [[pnlText && signed(pnl ?? 0), `RR ${stats.ratio.toFixed(2)}`].filter(Boolean).join(" · ")]
    : [
        [pnlText, `Cantidad: ${qtyText(stats.qty)}`].filter(Boolean).join(", "),
        `Ratio riesgo/beneficio: ${stats.ratio.toFixed(2)}`,
      ];
  const centerFill =
    pnl === null ? settings.lineColor : pnl >= 0 ? settings.profitColor : settings.stopColor;
  const showCenter = settings.alwaysShowStats || selected || isPreview;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-20"
      width={width}
      height={height}
    >
      <rect
        x={x1}
        y={Math.min(yEntry, yTp)}
        width={w}
        height={Math.abs(yTp - yEntry)}
        fill={settings.profitColor}
        fillOpacity={fill}
      />
      <rect
        x={x1}
        y={Math.min(yEntry, ySl)}
        width={w}
        height={Math.abs(ySl - yEntry)}
        fill={settings.stopColor}
        fillOpacity={fill}
      />

      {trade && (
        <g>
          <rect
            x={trade.x1}
            y={Math.min(yEntry, trade.yExit)}
            width={Math.max(1, trade.x2 - trade.x1)}
            height={Math.abs(trade.yExit - yEntry)}
            fill={trade.profit ? settings.profitColor : settings.stopColor}
            fillOpacity={Math.min(1, fill * 1.6)}
          />
          <line
            x1={trade.x1}
            y1={yEntry}
            x2={trade.x2}
            y2={trade.yExit}
            stroke={settings.lineColor}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        </g>
      )}

      <line x1={x1} y1={yEntry} x2={x1 + w} y2={yEntry} stroke={settings.lineColor} strokeWidth={1} />

      {settings.showLabels && (
        <>
          <Label
            x={cx}
            y={yTp}
            dir={tpDir}
            lines={targetLines}
            fill={settings.profitColor}
            color={settings.textColor}
            fontSize={settings.fontSize}
          />
          <Label
            x={cx}
            y={ySl}
            dir={slDir}
            lines={stopLines}
            fill={settings.stopColor}
            color={settings.textColor}
            fontSize={settings.fontSize}
          />
        </>
      )}
      {showCenter && (
        // Centered on the entry line
        <Label
          x={cx}
          y={yEntry}
          dir={0}
          lines={centerLines}
          fill={centerFill}
          color={settings.textColor}
          fontSize={settings.fontSize}
        />
      )}

      {/* Handles only while placing or selected, like TradingView */}
      {(isPreview || selected) &&
        points.map((p, i) => (
          <rect
            key={i}
            x={p.x - 4.5}
            y={p.y - 4.5}
            width={9}
            height={9}
            rx={1.5}
            fill="#131722"
            stroke="#2962ff"
            strokeWidth={1.5}
          />
        ))}
    </svg>
  );
}
