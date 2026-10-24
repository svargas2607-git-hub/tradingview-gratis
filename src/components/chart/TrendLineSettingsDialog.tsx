"use client";

import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useChartStore, type TrendLineDrawing } from "@/lib/store/chart-store";
import {
  defaultTrendLineSettings,
  trendLineSettingsOf,
  type TrendLineEnd,
  type TrendLineSettings,
} from "@/lib/trendline";
import {
  Check,
  CheckLabel,
  ColorInput,
  LevelInput,
  LINE_STYLES,
  Row,
  Select,
} from "./FibSettingsDialog";

const ENDS: { value: TrendLineEnd; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "arrow", label: "Flecha" },
];

/**
 * Settings for one trend line. Changes apply live (like TradingView);
 * "Cancelar" restores the line as it was when the dialog opened.
 */
export function TrendLineSettingsDialog() {
  const targetId = useChartStore((s) => s.trendSettingsTarget);
  const setTarget = useChartStore((s) => s.setTrendSettingsTarget);
  const line = useChartStore((s) => s.trendLines.find((t) => t.id === targetId) ?? null);

  return (
    <Dialog
      open={line !== null}
      onOpenChange={(v) => {
        if (!v) setTarget(null);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto bg-tv-panel sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Línea de tendencia</DialogTitle>
        </DialogHeader>
        {line && <SettingsBody key={line.id} line={line} onClose={() => setTarget(null)} />}
      </DialogContent>
    </Dialog>
  );
}

function SettingsBody({ line, onClose }: { line: TrendLineDrawing; onClose: () => void }) {
  const updateTrendLine = useChartStore((s) => s.updateTrendLine);
  const setTrendLineDefaults = useChartStore((s) => s.setTrendLineDefaults);
  const trendLineDefaults = useChartStore((s) => s.trendLineDefaults);
  const settings = trendLineSettingsOf(line.settings);

  // Snapshot to restore on "Cancelar"
  const original = useRef<TrendLineDrawing | null>(null);
  useEffect(() => {
    original.current = {
      ...line,
      points: line.points.map((p) => ({ ...p })),
      settings: { ...settings },
    };
    // Only when the dialog opens for this drawing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (patch: Partial<TrendLineSettings>) =>
    updateTrendLine(line.id, { settings: { ...settings, ...patch } });

  return (
    <div className="flex flex-col gap-3 text-xs">
      <Tabs defaultValue="style">
        <TabsList variant="line" className="w-full justify-start border-b border-tv-border">
          <TabsTrigger value="style" className="flex-none text-xs">Estilo</TabsTrigger>
          <TabsTrigger value="text" className="flex-none text-xs">Texto</TabsTrigger>
          <TabsTrigger value="coords" className="flex-none text-xs">Coordenadas</TabsTrigger>
        </TabsList>

        <TabsContent value="style" className="flex flex-col gap-4 pt-2">
          <Row label="Línea">
            <ColorInput value={settings.color} onChange={(color) => set({ color })} />
            <Select
              value={String(settings.width)}
              options={[1, 2, 3, 4].map((w) => ({ value: String(w), label: `${w}px` }))}
              onChange={(w) => set({ width: Number(w) })}
            />
            <Select
              value={settings.style}
              options={LINE_STYLES}
              onChange={(style) => set({ style })}
            />
          </Row>

          <Row label="Extremo izquierdo">
            <Select value={settings.leftEnd} options={ENDS} onChange={(leftEnd) => set({ leftEnd })} />
          </Row>
          <Row label="Extremo derecho">
            <Select value={settings.rightEnd} options={ENDS} onChange={(rightEnd) => set({ rightEnd })} />
          </Row>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <CheckLabel label="Extender a la izquierda" checked={settings.extendLeft} onChange={(extendLeft) => set({ extendLeft })} />
            <CheckLabel label="Extender a la derecha" checked={settings.extendRight} onChange={(extendRight) => set({ extendRight })} />
            <CheckLabel label="Punto medio" checked={settings.middlePoint} onChange={(middlePoint) => set({ middlePoint })} />
            <CheckLabel label="Etiquetas de precio" checked={settings.priceLabels} onChange={(priceLabels) => set({ priceLabels })} />
            <CheckLabel label="Estadísticas" checked={settings.stats} onChange={(stats) => set({ stats })} />
          </div>
        </TabsContent>

        <TabsContent value="text" className="flex flex-col gap-3 pt-2">
          <textarea
            value={settings.text}
            onChange={(e) => set({ text: e.target.value })}
            placeholder="Agregar texto"
            rows={3}
            className="w-full resize-none rounded border border-tv-border bg-tv-bg p-2 text-xs text-tv-text outline-none focus:border-tv-blue"
          />
          <Row label="Tamaño">
            <Select
              value={String(settings.fontSize)}
              options={[10, 11, 12, 14, 16, 20, 24].map((n) => ({ value: String(n), label: `${n}px` }))}
              onChange={(n) => set({ fontSize: Number(n) })}
            />
          </Row>
        </TabsContent>

        <TabsContent value="coords" className="flex flex-col gap-3 pt-2">
          {line.points.map((p, i) => (
            <Row key={i} label={`Punto ${i + 1}`}>
              <LevelInput
                value={p.price}
                wide
                onChange={(price) =>
                  updateTrendLine(line.id, {
                    points: line.points.map((q, j) => (j === i ? { ...q, price } : q)),
                  })
                }
              />
              <span className="text-tv-text-muted tabular-nums">
                {new Date(p.time * 1000).toLocaleString("es-AR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            </Row>
          ))}
          <label className="flex cursor-pointer items-center gap-2 text-tv-text">
            <Check
              checked={!!line.locked}
              onChange={(locked) => updateTrendLine(line.id, { locked })}
            />
            Bloquear (no se puede mover)
          </label>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-tv-border pt-3">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => set({ ...(trendLineDefaults ?? defaultTrendLineSettings()) })}
            className="text-tv-text-muted hover:text-tv-text"
            title="Volver al estilo predeterminado"
          >
            Restablecer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            // Text is per line, not part of the style
            onClick={() => setTrendLineDefaults({ ...settings, text: "" })}
            className="text-tv-text-muted hover:text-tv-text"
            title="Las próximas líneas de tendencia usarán este estilo"
          >
            Guardar como predeterminado
          </Button>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const o = original.current;
              if (o) updateTrendLine(line.id, { points: o.points, settings: o.settings, locked: o.locked });
              onClose();
            }}
          >
            Cancelar
          </Button>
          <Button size="sm" onClick={onClose} className="bg-tv-blue hover:bg-tv-blue/90">
            Aceptar
          </Button>
        </div>
      </div>
    </div>
  );
}
