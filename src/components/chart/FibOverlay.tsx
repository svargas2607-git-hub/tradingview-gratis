"use client";

import { formatPrice } from "@/lib/format";
import { dashArray, formatRatio, type FibLevel, type FibSettings } from "@/lib/fibonacci";

/** Pixel layout of one drawing — shared by the overlay and hit-testing */
export interface FibGeometry {
  /** Pixel coords of the clicked points (A, B[, C]) */
  points: { x: number; y: number }[];
  /** Levels with their pixel Y already resolved */
  levels: (FibLevel & { y: number })[];
  /** Horizontal span of the level lines (after extend left / right) */
  x1: number;
  x2: number;
}

interface Props extends FibGeometry {
  settings: FibSettings;
  isPreview: boolean;
  selected: boolean;
  /** Visible drawing area (main pane minus price scale) */
  width: number;
  height: number;
}

/** Levels span from the first point to the last one (min 40px so it's visible) */
export function fibSpan(
  points: { x: number }[],
  settings: Pick<FibSettings, "extendLeft" | "extendRight">,
  width: number,
) {
  const xs = points.map((p) => p.x);
  const left = Math.min(...xs);
  const right = Math.max(Math.max(...xs), left + 40);
  return {
    x1: settings.extendLeft ? 0 : left,
    x2: settings.extendRight ? width : right,
  };
}

export function FibOverlay({
  points,
  levels,
  x1,
  x2,
  settings,
  isPreview,
  selected,
  width,
  height,
}: Props) {
  if (points.length === 0) return null;

  const lineWidth = settings.levelsLine.width;
  const dash = isPreview ? "4,3" : dashArray(settings.levelsLine.style, lineWidth);
  const showLabels = settings.showLevels || settings.showPrices;

  // Label anchor: outside the levels, or inside the chart edge when extended
  let labelX: number;
  let anchor: "start" | "end";
  if (settings.labelSide === "left") {
    [labelX, anchor] = settings.extendLeft ? [4, "start"] : [x1 - 4, "end"];
  } else {
    [labelX, anchor] = settings.extendRight ? [width - 4, "end"] : [x2 + 4, "start"];
  }

  // Baseline offset: above the line, centered on it, or below it
  const labelDy = { top: "-0.4em", middle: "0.32em", bottom: "1.1em" }[
    settings.labelVertical ?? "middle"
  ];

  const label = (l: FibLevel) => {
    const ratio = formatRatio(l.ratio, settings.levelsAsPercent);
    const price = formatPrice(l.price);
    // TradingView format: 61.80% (84,119.78)
    if (settings.showLevels && settings.showPrices) return `${ratio} (${price})`;
    return settings.showLevels ? ratio : price;
  };

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-20"
      width={width}
      height={height}
    >
      {/* Bands between consecutive levels */}
      {settings.background &&
        levels.slice(0, -1).map((l, i) => {
          const next = levels[i + 1];
          return (
            <rect
              key={`band-${i}`}
              x={x1}
              y={Math.min(l.y, next.y)}
              width={x2 - x1}
              height={Math.abs(next.y - l.y)}
              fill={next.color}
              opacity={settings.backgroundOpacity / 100}
            />
          );
        })}

      {levels.map((l, i) => (
        <g key={i}>
          <line
            x1={x1}
            x2={x2}
            y1={l.y}
            y2={l.y}
            stroke={l.color}
            strokeWidth={lineWidth}
            strokeDasharray={dash}
          />
          {showLabels && (
            <text
              x={labelX}
              y={l.y}
              dy={labelDy}
              textAnchor={anchor}
              fill={l.color}
              fontSize={settings.fontSize}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {label(l)}
            </text>
          )}
        </g>
      ))}

      {/* Trend line through the clicked points */}
      {points.length > 1 && (settings.trendLine.visible || isPreview || selected) && (
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={settings.trendLine.color}
          strokeWidth={1}
          strokeDasharray={dashArray(settings.trendLine.style)}
          opacity={settings.trendLine.visible ? 1 : 0.5}
        />
      )}
      {/* Anchors only while placing or selected, like TradingView */}
      {(isPreview || selected) &&
        points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={selected ? 5 : 3.5}
            fill="#131722"
            stroke="#2962ff"
            strokeWidth={1.5}
          />
        ))}
    </svg>
  );
}
