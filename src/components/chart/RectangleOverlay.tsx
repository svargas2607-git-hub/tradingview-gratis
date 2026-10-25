"use client";

import { formatPrice } from "@/lib/format";
import { dashArray } from "@/lib/fibonacci";
import type { RectangleBox, RectangleSettings } from "@/lib/rectangle";

interface Px {
  x: number;
  y: number;
}

/** Pixel layout of one rectangle — shared by the overlay and hit-testing */
export interface RectangleGeometry {
  /** Pixel coords of the two clicked corners */
  points: Px[];
  /** Drawn box after extend left / right */
  box: RectangleBox;
}

interface Props extends RectangleGeometry {
  settings: RectangleSettings;
  /** Prices of the two corners, for the price labels */
  prices: number[];
  isPreview: boolean;
  selected: boolean;
  width: number;
  height: number;
}

const TEXT_PAD = 8;

export function RectangleOverlay({
  points,
  box,
  settings,
  prices,
  isPreview,
  selected,
  width,
  height,
}: Props) {
  if (points.length < 2) return null;
  const { x1, x2, y1, y2 } = box;
  const midY = (y1 + y2) / 2;
  const lines = settings.text.split("\n");
  const lineH = settings.fontSize * 1.25;

  const anchorX =
    settings.textHAlign === "left" ? x1 + TEXT_PAD : settings.textHAlign === "right" ? x2 - TEXT_PAD : (x1 + x2) / 2;
  const textAnchor =
    settings.textHAlign === "left" ? "start" : settings.textHAlign === "right" ? "end" : "middle";
  const blockH = lines.length * lineH;
  const firstBaseline =
    (settings.textVAlign === "top"
      ? y1 + TEXT_PAD
      : settings.textVAlign === "bottom"
        ? y2 - TEXT_PAD - blockH
        : midY - blockH / 2) +
    settings.fontSize;

  // Top edge carries the higher price
  const [topPrice, bottomPrice] = prices[0] >= prices[1] ? prices : [prices[1], prices[0]];

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-20"
      width={width}
      height={height}
    >
      <rect
        x={x1}
        y={y1}
        width={x2 - x1}
        height={y2 - y1}
        fill={settings.background ? settings.backgroundColor : "none"}
        fillOpacity={settings.backgroundOpacity / 100}
        stroke={settings.border ? settings.borderColor : "none"}
        strokeWidth={settings.borderWidth}
        strokeDasharray={dashArray(settings.borderStyle, settings.borderWidth)}
      />

      {settings.middleLine && (
        <line
          x1={x1}
          y1={midY}
          x2={x2}
          y2={midY}
          stroke={settings.middleColor}
          strokeWidth={settings.middleWidth}
          strokeDasharray={dashArray(settings.middleStyle, settings.middleWidth)}
        />
      )}

      {settings.text &&
        lines.map((line, i) => (
          <text
            key={`line-${i}`}
            x={anchorX}
            y={firstBaseline + i * lineH}
            textAnchor={textAnchor}
            fill={settings.textColor}
            fontSize={settings.fontSize}
            fontWeight={settings.bold ? 700 : 400}
            fontStyle={settings.italic ? "italic" : "normal"}
          >
            {line}
          </text>
        ))}

      {settings.priceLabels && (
        <>
          <text
            x={x2}
            y={y1}
            dy={-5}
            textAnchor="end"
            fill={settings.borderColor}
            fontSize={11}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatPrice(topPrice)}
          </text>
          <text
            x={x2}
            y={y2}
            dy={14}
            textAnchor="end"
            fill={settings.borderColor}
            fontSize={11}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatPrice(bottomPrice)}
          </text>
        </>
      )}

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
