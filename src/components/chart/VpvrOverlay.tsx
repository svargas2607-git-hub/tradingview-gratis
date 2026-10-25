"use client";

import { formatPrice, formatVolume } from "@/lib/format";
import type { VpvrSettings } from "@/lib/vpvr";

/** One histogram row already converted to pixels */
export interface VpvrRowGeometry {
  y1: number;
  y2: number;
  up: number;
  down: number;
  total: number;
  inValueArea: boolean;
}

export interface VpvrGeometry {
  rows: VpvrRowGeometry[];
  maxVolume: number;
  pocY: number;
  pocPrice: number;
  vahY: number;
  vahPrice: number;
  valY: number;
  valPrice: number;
  /** Developing POC polyline, in pixels */
  developing: { x: number; y: number }[];
}

interface Props {
  geometry: VpvrGeometry;
  settings: VpvrSettings;
  /** Width of the plot area (without the price scale) and the height of the main pane */
  width: number;
  height: number;
}

function withOpacity(opacity: number) {
  return Math.max(0, Math.min(1, opacity / 100));
}

export function VpvrOverlay({ geometry, settings, width, height }: Props) {
  const { rows, maxVolume } = geometry;
  if (rows.length === 0 || maxVolume <= 0) return null;

  const left = settings.placement === "left";
  const maxBar = (width * settings.widthPct) / 100;
  const opacity = withOpacity(settings.opacity);
  const edge = left ? 0 : width;
  /** Bar from the anchored edge inwards: [x of the start, length] */
  const bar = (offset: number, length: number): [number, number] =>
    left ? [edge + offset, length] : [edge - offset - length, length];
  const scale = (v: number) => (v / maxVolume) * maxBar;

  const top = rows[rows.length - 1].y1;
  const bottom = rows[0].y2;
  const pocTotal = scale(rows.find((r) => r.total === maxVolume)?.total ?? maxVolume);
  const pocX1 = settings.pocExtend ? 0 : left ? 0 : width - pocTotal;
  const pocX2 = settings.pocExtend ? width : left ? pocTotal : width;
  const vaLineX1 = left ? 0 : width - maxBar;
  const vaLineX2 = left ? maxBar : width;

  return (
    <svg className="pointer-events-none absolute left-0 top-0 z-[5]" width={width} height={height}>
      {settings.histogramBox && (
        <rect
          x={left ? 0 : width - maxBar}
          y={Math.min(top, bottom)}
          width={maxBar}
          height={Math.abs(bottom - top)}
          fill="none"
          stroke={settings.boxColor}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}

      {rows.map((r, i) => {
        const h = Math.max(1, Math.abs(r.y2 - r.y1) - 1);
        const y = Math.min(r.y1, r.y2) + 0.5;
        const upColor = r.inValueArea ? settings.vaUpColor : settings.upColor;
        const downColor = r.inValueArea ? settings.vaDownColor : settings.downColor;
        if (settings.volumeMode === "total") {
          const [x, w] = bar(0, scale(r.total));
          return <rect key={i} x={x} y={y} width={w} height={h} fill={upColor} fillOpacity={opacity} />;
        }
        const upLen = scale(r.up);
        const downLen = scale(r.down);
        const [ux, uw] = bar(0, upLen);
        const [dx, dw] = bar(upLen, downLen);
        return (
          <g key={i}>
            <rect x={ux} y={y} width={uw} height={h} fill={upColor} fillOpacity={opacity} />
            <rect x={dx} y={y} width={dw} height={h} fill={downColor} fillOpacity={opacity} />
          </g>
        );
      })}

      {settings.values &&
        rows.map((r, i) => {
          const h = Math.abs(r.y2 - r.y1);
          if (h < 9 || r.total <= 0) return null;
          const len = scale(r.total);
          return (
            <text
              key={`v-${i}`}
              x={left ? len + 4 : width - len - 4}
              y={Math.min(r.y1, r.y2) + h / 2}
              dy="0.35em"
              textAnchor={left ? "start" : "end"}
              fill={settings.valuesColor}
              fontSize={Math.min(10, h - 1)}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatVolume(r.total)}
            </text>
          );
        })}

      {settings.developingPoc && geometry.developing.length > 1 && (
        <polyline
          points={geometry.developing.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={settings.developingPocColor}
          strokeWidth={1}
        />
      )}

      {settings.vah && (
        <g>
          <line
            x1={vaLineX1}
            x2={vaLineX2}
            y1={geometry.vahY}
            y2={geometry.vahY}
            stroke={settings.vahColor}
            strokeWidth={settings.vaLineWidth}
          />
          <text
            x={left ? vaLineX2 - 4 : vaLineX1 + 4}
            y={geometry.vahY}
            dy={-3}
            textAnchor={left ? "end" : "start"}
            fill={settings.vahColor}
            fontSize={10}
          >
            VAH {formatPrice(geometry.vahPrice)}
          </text>
        </g>
      )}
      {settings.val && (
        <g>
          <line
            x1={vaLineX1}
            x2={vaLineX2}
            y1={geometry.valY}
            y2={geometry.valY}
            stroke={settings.valColor}
            strokeWidth={settings.vaLineWidth}
          />
          <text
            x={left ? vaLineX2 - 4 : vaLineX1 + 4}
            y={geometry.valY}
            dy={12}
            textAnchor={left ? "end" : "start"}
            fill={settings.valColor}
            fontSize={10}
          >
            VAL {formatPrice(geometry.valPrice)}
          </text>
        </g>
      )}

      {settings.poc && (
        <g>
          <line
            x1={pocX1}
            x2={pocX2}
            y1={geometry.pocY}
            y2={geometry.pocY}
            stroke={settings.pocColor}
            strokeWidth={settings.pocWidth}
          />
          <text
            x={left ? pocTotal + 4 : width - pocTotal - 4}
            y={geometry.pocY}
            dy={-3}
            textAnchor={left ? "start" : "end"}
            fill={settings.pocColor}
            fontSize={10}
          >
            POC {formatPrice(geometry.pocPrice)}
          </text>
        </g>
      )}
    </svg>
  );
}
