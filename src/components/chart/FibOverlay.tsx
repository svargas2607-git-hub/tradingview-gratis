"use client";

import { formatPrice } from "@/lib/format";
import type { FibLevel } from "@/lib/fibonacci";

interface Props {
  /** Pixel coords of the clicked points (A, B[, C]) */
  points: { x: number; y: number }[];
  /** Levels with their pixel Y already resolved */
  levels: (FibLevel & { y: number })[];
  isPreview: boolean;
  /** Visible drawing area (main pane minus price scale) */
  width: number;
  height: number;
}

export function FibOverlay({ points, levels, isPreview, width, height }: Props) {
  if (points.length === 0) return null;

  const xs = points.map((p) => p.x);
  // Levels span from the first point to the last one (min 40px so it's visible)
  const left = Math.min(...xs);
  const right = Math.max(Math.max(...xs), left + 40);
  const dash = isPreview ? "4,3" : undefined;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-20"
      width={width}
      height={height}
    >
      {/* Bands between consecutive levels */}
      {levels.slice(0, -1).map((l, i) => {
        const next = levels[i + 1];
        return (
          <rect
            key={`band-${l.ratio}`}
            x={left}
            y={Math.min(l.y, next.y)}
            width={right - left}
            height={Math.abs(next.y - l.y)}
            fill={next.color}
            opacity={0.1}
          />
        );
      })}

      {levels.map((l) => (
        <g key={l.ratio}>
          <line
            x1={left}
            x2={right}
            y1={l.y}
            y2={l.y}
            stroke={l.color}
            strokeWidth={1}
            strokeDasharray={dash}
          />
          <text
            x={left - 4}
            y={l.y}
            dy="0.32em"
            textAnchor="end"
            fill={l.color}
            fontSize={10}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {l.ratio} ({formatPrice(l.price)})
          </text>
        </g>
      ))}

      {/* Trend line through the clicked points */}
      {points.length > 1 && (
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="#787b86"
          strokeWidth={1}
          strokeDasharray="4,3"
        />
      )}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3.5}
          fill="#131722"
          stroke="#2962ff"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}
