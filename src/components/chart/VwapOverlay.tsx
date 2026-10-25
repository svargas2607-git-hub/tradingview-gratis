"use client";

import type { VwapLineStyle, VwapSettings } from "@/lib/vwap";

/** One anchor period of the VWAP already converted to pixels */
export interface VwapSegment {
  x: number[];
  vwap: number[];
  /** Per band [upper, lower] pixel Y of every point; null when the band is off */
  bands: ({ upper: number[]; lower: number[] } | null)[];
}

export interface VwapGeometry {
  segments: VwapSegment[];
}

interface Props {
  geometry: VwapGeometry;
  settings: VwapSettings;
  /** Width of the plot area (without the price scale) and the height of the main pane */
  width: number;
  height: number;
}

const DASH: Record<VwapLineStyle, string | undefined> = {
  solid: undefined,
  dashed: "6 4",
  dotted: "1.5 3",
};

function points(xs: number[], ys: number[]): string {
  return xs.map((x, i) => `${x},${ys[i]}`).join(" ");
}

export function VwapOverlay({ geometry, settings, width, height }: Props) {
  const fillOpacity = Math.max(0, Math.min(1, settings.fillOpacity / 100));

  return (
    <svg className="pointer-events-none absolute left-0 top-0 z-[5]" width={width} height={height}>
      {geometry.segments.map((seg, si) => (
        <g key={si}>
          {settings.bands.map((band, bi) => {
            const g = seg.bands[bi];
            if (!g || !band.fill || seg.x.length < 2) return null;
            const poly = `${points(seg.x, g.upper)} ${points([...seg.x].reverse(), [...g.lower].reverse())}`;
            return <polygon key={`f${bi}`} points={poly} fill={band.fillColor} fillOpacity={fillOpacity} stroke="none" />;
          })}

          {settings.bands.map((band, bi) => {
            const g = seg.bands[bi];
            if (!g) return null;
            return (
              <g key={`b${bi}`} fill="none" strokeWidth={settings.bandWidth} strokeDasharray={DASH[settings.bandStyle]}>
                <polyline points={points(seg.x, g.upper)} stroke={band.upperColor} />
                <polyline points={points(seg.x, g.lower)} stroke={band.lowerColor} />
              </g>
            );
          })}

          {settings.lineVisible && (
            <polyline
              points={points(seg.x, seg.vwap)}
              fill="none"
              stroke={settings.color}
              strokeWidth={settings.width}
              strokeDasharray={DASH[settings.style]}
            />
          )}
        </g>
      ))}
    </svg>
  );
}
