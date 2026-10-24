"use client";

import { elliottLabel, elliottLabelAbove, type ElliottKind } from "@/lib/elliott";

interface Px {
  x: number;
  y: number;
}

/** Pixel layout of one Elliott wave — shared by the overlay and hit-testing */
export interface ElliottGeometry {
  points: Px[];
}

interface Props extends ElliottGeometry {
  kind: ElliottKind;
  color: string;
  /** Prices of the points, to place each label above a high or below a low */
  prices: number[];
  isPreview: boolean;
  selected: boolean;
  width: number;
  height: number;
}

export function ElliottOverlay({
  kind,
  color,
  points,
  prices,
  isPreview,
  selected,
  width,
  height,
}: Props) {
  if (points.length < 2) return null;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-20"
      width={width}
      height={height}
    >
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((p, i) => (
        <text
          key={`label-${i}`}
          x={p.x}
          y={p.y}
          dy={elliottLabelAbove(prices, i) ? -9 : 19}
          textAnchor="middle"
          fill={color}
          fontSize={13}
          fontWeight={600}
        >
          {elliottLabel(kind, i)}
        </text>
      ))}
      {/* Anchors only while placing or selected, like TradingView */}
      {(isPreview || selected) &&
        points.map((p, i) => (
          <circle
            key={`anchor-${i}`}
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
