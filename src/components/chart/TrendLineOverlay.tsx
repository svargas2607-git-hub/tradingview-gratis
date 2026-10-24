"use client";

import { formatPrice } from "@/lib/format";
import { dashArray } from "@/lib/fibonacci";
import type { TrendLineSettings } from "@/lib/trendline";

interface Px {
  x: number;
  y: number;
}

/** Pixel layout of one trend line — shared by the overlay and hit-testing */
export interface TrendGeometry {
  /** Pixel coords of the clicked points (A, B) */
  points: Px[];
  /** Drawn segment after extend left / right, left end first */
  segment: [Px, Px];
}

interface Props extends TrendGeometry {
  settings: TrendLineSettings;
  /** Prices of A and B, for the price labels */
  prices: number[];
  /** Stats lines shown next to B (null = hidden) */
  stats: string[] | null;
  isPreview: boolean;
  selected: boolean;
  width: number;
  height: number;
}

/** Filled arrowhead pointing from `from` to `tip` */
function arrowHead(from: Px, tip: Px, size: number) {
  const ang = Math.atan2(tip.y - from.y, tip.x - from.x);
  const wing = (d: number) =>
    `${tip.x - size * Math.cos(ang + d)},${tip.y - size * Math.sin(ang + d)}`;
  return `${tip.x},${tip.y} ${wing(0.45)} ${wing(-0.45)}`;
}

export function TrendLineOverlay({
  points,
  segment,
  settings,
  prices,
  stats,
  isPreview,
  selected,
  width,
  height,
}: Props) {
  if (points.length < 2) return null;
  const [l, r] = segment;
  const [a, b] = points;
  const arrowSize = 6 + settings.width * 2;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  // Text runs along the line, never upside down
  let angle = (Math.atan2(r.y - l.y, r.x - l.x) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-20"
      width={width}
      height={height}
    >
      <line
        x1={l.x}
        y1={l.y}
        x2={r.x}
        y2={r.y}
        stroke={settings.color}
        strokeWidth={settings.width}
        strokeDasharray={dashArray(settings.style, settings.width)}
        strokeLinecap="round"
      />
      {settings.leftEnd === "arrow" && (
        <polygon points={arrowHead(r, l, arrowSize)} fill={settings.color} />
      )}
      {settings.rightEnd === "arrow" && (
        <polygon points={arrowHead(l, r, arrowSize)} fill={settings.color} />
      )}

      {settings.text && (
        <text
          x={mid.x}
          y={mid.y}
          dy={-settings.width - 4}
          textAnchor="middle"
          fill={settings.color}
          fontSize={settings.fontSize}
          transform={`rotate(${angle} ${mid.x} ${mid.y})`}
        >
          {settings.text}
        </text>
      )}

      {settings.priceLabels &&
        points.map((p, i) => (
          <text
            key={`price-${i}`}
            x={p.x}
            y={p.y}
            // Above the higher point, below the lower one
            dy={p.y <= points[1 - i].y ? -8 : 16}
            textAnchor="middle"
            fill={settings.color}
            fontSize={11}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatPrice(prices[i])}
          </text>
        ))}

      {stats && (
        <g>
          <rect
            x={b.x + 10}
            y={b.y - 8 - stats.length * 15}
            width={Math.max(...stats.map((s) => s.length)) * 6.4 + 12}
            height={stats.length * 15 + 8}
            rx={3}
            fill="#1e222d"
            opacity={0.92}
            stroke="#2a2e39"
          />
          {stats.map((s, i) => (
            <text
              key={i}
              x={b.x + 16}
              y={b.y - stats.length * 15 + i * 15 + 3}
              fill="#d1d4dc"
              fontSize={11}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {s}
            </text>
          ))}
        </g>
      )}

      {settings.middlePoint && (
        <circle cx={mid.x} cy={mid.y} r={3} fill={settings.color} />
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
