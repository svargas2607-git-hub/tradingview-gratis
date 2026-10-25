"use client";

import { RECTANGLE_FILL_OPACITY } from "@/lib/rectangle";

interface Px {
  x: number;
  y: number;
}

/** Pixel layout of one rectangle — shared by the overlay and hit-testing */
export interface RectangleGeometry {
  /** Two opposite corners, as placed */
  points: Px[];
}

interface Props extends RectangleGeometry {
  color: string;
  isPreview: boolean;
  selected: boolean;
  width: number;
  height: number;
}

export function RectangleOverlay({ color, points, isPreview, selected, width, height }: Props) {
  if (points.length < 2) return null;
  const [a, b] = points;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-20"
      width={width}
      height={height}
    >
      <rect
        x={x}
        y={y}
        width={Math.abs(a.x - b.x)}
        height={Math.abs(a.y - b.y)}
        fill={color}
        fillOpacity={RECTANGLE_FILL_OPACITY}
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Corner anchors only while placing or selected, like TradingView */}
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
