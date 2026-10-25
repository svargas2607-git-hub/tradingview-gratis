"use client";

import { Crosshair, MoveHorizontal } from "lucide-react";
import { useChartStore, type LayoutKind } from "@/lib/store/chart-store";

const OPTIONS: { kind: LayoutKind; label: string; cells: string }[] = [
  { kind: "1", label: "1 gráfico", cells: "grid-cols-1 grid-rows-1" },
  { kind: "2v", label: "2 gráficos (lado a lado)", cells: "grid-cols-2 grid-rows-1" },
  { kind: "2h", label: "2 gráficos (apilados)", cells: "grid-cols-1 grid-rows-2" },
  { kind: "4", label: "4 gráficos", cells: "grid-cols-2 grid-rows-2" },
];

const CELLS: Record<LayoutKind, number> = { "1": 1, "2v": 2, "2h": 2, "4": 4 };

export function LayoutSelector() {
  const layout = useChartStore((s) => s.layout);
  const setLayout = useChartStore((s) => s.setLayout);
  const syncCrosshair = useChartStore((s) => s.syncCrosshair);
  const syncRange = useChartStore((s) => s.syncRange);
  const setSyncCrosshair = useChartStore((s) => s.setSyncCrosshair);
  const setSyncRange = useChartStore((s) => s.setSyncRange);

  return (
    <div className="flex items-center gap-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.kind}
          type="button"
          title={o.label}
          onClick={() => setLayout(o.kind)}
          className={`flex h-7 w-7 items-center justify-center rounded hover:bg-tv-panel-hover ${
            layout === o.kind ? "bg-tv-panel-hover text-tv-blue" : "text-tv-text-muted"
          }`}
        >
          <span className={`grid h-4 w-4 gap-px ${o.cells}`}>
            {Array.from({ length: CELLS[o.kind] }).map((_, i) => (
              <span key={i} className="rounded-[1px] border border-current" />
            ))}
          </span>
        </button>
      ))}
      {layout !== "1" && (
        <>
          <button
            type="button"
            title="Sincronizar crosshair"
            onClick={() => setSyncCrosshair(!syncCrosshair)}
            className={`ml-1 flex h-7 w-7 items-center justify-center rounded hover:bg-tv-panel-hover ${
              syncCrosshair ? "text-tv-blue" : "text-tv-text-muted"
            }`}
          >
            <Crosshair className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Sincronizar rango de tiempo"
            onClick={() => setSyncRange(!syncRange)}
            className={`flex h-7 w-7 items-center justify-center rounded hover:bg-tv-panel-hover ${
              syncRange ? "text-tv-blue" : "text-tv-text-muted"
            }`}
          >
            <MoveHorizontal className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
