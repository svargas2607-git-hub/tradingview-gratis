"use client";

import { Header } from "@/components/layout/Header";
import { LeftSidebar } from "@/components/layout/LeftSidebar";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { BottomPanel } from "@/components/layout/BottomPanel";
import { PriceChart } from "@/components/chart/PriceChart";
import { IndicatorSettingsDialog } from "@/components/chart/IndicatorSettingsDialog";
import { VpvrSettingsDialog } from "@/components/chart/VpvrSettingsDialog";
import { VwapSettingsDialog } from "@/components/chart/VwapSettingsDialog";
import { FibSettingsDialog } from "@/components/chart/FibSettingsDialog";
import { TrendLineSettingsDialog } from "@/components/chart/TrendLineSettingsDialog";
import { RectangleSettingsDialog } from "@/components/chart/RectangleSettingsDialog";
import { PositionSettingsDialog } from "@/components/chart/PositionSettingsDialog";
import { useRef, useState } from "react";
import { useChartStore } from "@/lib/store/chart-store";

export default function HomePage() {
  const symbol = useChartStore((s) => s.symbol);
  const timeframe = useChartStore((s) => s.timeframe);
  const indicators = useChartStore((s) => s.indicators);
  const hidden = useChartStore((s) => s.hidden);
  const config = useChartStore((s) => s.config);
  const layout =useChartStore((s) => s.layout);
  const panes = useChartStore((s) => s.panes);
  const activePaneId = useChartStore((s) => s.activePaneId);
  const setActivePane = useChartStore((s) => s.setActivePane);
  const gridRef = useRef<HTMLDivElement>(null);
  /** Share of the width / height the first column / row takes (splitters) */
  const [colFrac, setColFrac] = useState(0.5);
  const [rowFrac, setRowFrac] = useState(0.5);
  const hasCols = layout === "2v" || layout === "4";
  const hasRows = layout === "2h" || layout === "4";

  const startDrag = (axis: "col" | "row") => (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    const move = (ev: PointerEvent) => {
      if (axis === "col") {
        setColFrac(Math.min(0.85, Math.max(0.15, (ev.clientX - rect.left) / rect.width)));
      } else {
        setRowFrac(Math.min(0.85, Math.max(0.15, (ev.clientY - rect.top) / rect.height)));
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-tv-bg">
      <Header />
      <div className="flex min-h-0 flex-1">
        <LeftSidebar />
        <main className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={gridRef}
            className="relative grid min-h-0 flex-1 gap-px bg-tv-border"
            style={{
              gridTemplateColumns: hasCols ? `${colFrac}fr ${1 - colFrac}fr` : "1fr",
              gridTemplateRows: hasRows ? `${rowFrac}fr ${1 - rowFrac}fr` : "1fr",
            }}
          >
            {panes.map((p) => {
              const active = p.id === activePaneId;
              return (
                <div
                  key={p.id}
                  onPointerDownCapture={() => setActivePane(p.id)}
                  className={`relative min-h-0 min-w-0 bg-tv-bg ${
                    active && panes.length > 1 ? "outline outline-1 -outline-offset-1 outline-tv-blue" : ""
                  }`}
                >
                  <PriceChart
                    paneId={p.id}
                    symbol={active ? symbol : p.symbol}
                    timeframe={active ? timeframe : p.timeframe}
                    indicators={(active ? indicators : p.indicators) ?? indicators}
                    hidden={(active ? hidden : p.hidden) ?? hidden}
                    config={(active ? config : p.config) ?? config}
                  />
                </div>
              );
            })}
            {hasCols && (
              <div
                onPointerDown={startDrag("col")}
                className="absolute inset-y-0 z-20 w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-tv-blue/50"
                style={{ left: `${colFrac * 100}%` }}
              />
            )}
            {hasRows && (
              <div
                onPointerDown={startDrag("row")}
                className="absolute inset-x-0 z-20 h-1.5 -translate-y-1/2 cursor-row-resize hover:bg-tv-blue/50"
                style={{ top: `${rowFrac * 100}%` }}
              />
            )}
          </div>
        </main>
        <RightSidebar />
      </div>
      <BottomPanel />
      <IndicatorSettingsDialog />
      <VpvrSettingsDialog />
      <VwapSettingsDialog />
      <FibSettingsDialog />
      <TrendLineSettingsDialog />
      <RectangleSettingsDialog />
      <PositionSettingsDialog />
    </div>
  );
}
