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
import { useChartStore, type PositionDrawing } from "@/lib/store/chart-store";
import {
  defaultPositionSettings,
  positionSettingsOf,
  positionStats,
  type PositionSettings,
} from "@/lib/position";
import { formatPrice } from "@/lib/format";
import { Check, CheckLabel, ColorInput, LevelInput, Row, Select } from "./FibSettingsDialog";

/**
 * Settings for one long / short position. Changes apply live (like
 * TradingView); "Cancelar" restores the position as it was when the dialog opened.
 */
export function PositionSettingsDialog() {
  const targetId = useChartStore((s) => s.positionSettingsTarget);
  const setTarget = useChartStore((s) => s.setPositionSettingsTarget);
  const position = useChartStore((s) => s.positions.find((p) => p.id === targetId) ?? null);

  return (
    <Dialog
      open={position !== null}
      onOpenChange={(v) => {
        if (!v) setTarget(null);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto bg-tv-panel sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {position?.side === "short" ? "Posición corta" : "Posición larga"}
          </DialogTitle>
        </DialogHeader>
        {position && (
          <SettingsBody key={position.id} position={position} onClose={() => setTarget(null)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SettingsBody({ position, onClose }: { position: PositionDrawing; onClose: () => void }) {
  const updatePosition = useChartStore((s) => s.updatePosition);
  const setPositionDefaults = useChartStore((s) => s.setPositionDefaults);
  const positionDefaults = useChartStore((s) => s.positionDefaults);
  const settings = positionSettingsOf(position.settings);
  const stats = positionStats(position, settings);
  const long = position.side === "long";
  const entry = position.entry.price;

  // Snapshot to restore on "Cancelar"
  const original = useRef<PositionDrawing | null>(null);
  useEffect(() => {
    original.current = { ...position, entry: { ...position.entry }, settings: { ...settings } };
    // Only when the dialog opens for this drawing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (patch: Partial<PositionSettings>) =>
    updatePosition(position.id, { settings: { ...settings, ...patch } });

  // Target and stop must stay on their own side of the entry
  const setTp = (tp: number) => {
    if (long ? tp > entry : tp < entry) updatePosition(position.id, { tp });
  };
  const setSl = (sl: number) => {
    if (long ? sl < entry : sl > entry) updatePosition(position.id, { sl });
  };
  const setEntry = (price: number) => {
    const lo = Math.min(position.tp, position.sl);
    const hi = Math.max(position.tp, position.sl);
    if (price > lo && price < hi) updatePosition(position.id, { entry: { ...position.entry, price } });
  };

  return (
    <div className="flex flex-col gap-3 text-xs">
      <Tabs defaultValue="inputs">
        <TabsList variant="line" className="w-full justify-start border-b border-tv-border">
          <TabsTrigger value="inputs" className="flex-none text-xs">Entradas</TabsTrigger>
          <TabsTrigger value="style" className="flex-none text-xs">Estilo</TabsTrigger>
        </TabsList>

        <TabsContent value="inputs" className="flex flex-col gap-3 pt-2">
          <Row label="Tamaño de la cuenta">
            <LevelInput value={settings.accountSize} wide onChange={(accountSize) => accountSize > 0 && set({ accountSize })} />
          </Row>
          <Row label="Tamaño del lote">
            <LevelInput value={settings.lotSize} wide onChange={(lotSize) => lotSize > 0 && set({ lotSize })} />
          </Row>
          <Row label="Riesgo">
            <LevelInput value={settings.riskPct} onChange={(riskPct) => riskPct > 0 && set({ riskPct })} />
            <span className="text-tv-text-muted">
              % · {formatPrice((settings.accountSize * settings.riskPct) / 100)}
            </span>
          </Row>
          <Row label="Precio de entrada">
            <LevelInput value={entry} wide price onChange={setEntry} />
          </Row>
          <Row label="Nivel de beneficio">
            <LevelInput value={position.tp} wide price onChange={setTp} />
            <span className="text-tv-text-muted tabular-nums">{stats.targetPct.toFixed(2)}%</span>
          </Row>
          <Row label="Nivel de stop">
            <LevelInput value={position.sl} wide price onChange={setSl} />
            <span className="text-tv-text-muted tabular-nums">{stats.stopPct.toFixed(2)}%</span>
          </Row>
          <div className="rounded border border-tv-border bg-tv-bg p-2 text-tv-text-muted tabular-nums">
            Cantidad {formatPrice(stats.qty)} · Ratio riesgo/beneficio {stats.ratio.toFixed(2)}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-tv-text">
            <Check
              checked={!!position.locked}
              onChange={(locked) => updatePosition(position.id, { locked })}
            />
            Bloquear (no se puede mover)
          </label>
        </TabsContent>

        <TabsContent value="style" className="flex flex-col gap-4 pt-2">
          <Row label="Línea">
            <ColorInput value={settings.lineColor} onChange={(lineColor) => set({ lineColor })} />
          </Row>
          <Row label="Color de beneficio">
            <ColorInput value={settings.profitColor} onChange={(profitColor) => set({ profitColor })} />
          </Row>
          <Row label="Color de stop">
            <ColorInput value={settings.stopColor} onChange={(stopColor) => set({ stopColor })} />
          </Row>
          <Row label="Opacidad del fondo">
            <input
              type="range"
              min={0}
              max={100}
              value={settings.opacity}
              onChange={(e) => set({ opacity: Number(e.target.value) })}
              className="w-32 accent-tv-blue"
            />
            <span className="w-8 text-tv-text-muted tabular-nums">{settings.opacity}%</span>
          </Row>
          <Row label="Texto">
            <ColorInput value={settings.textColor} onChange={(textColor) => set({ textColor })} />
            <Select
              value={String(settings.fontSize)}
              options={[10, 11, 12, 14, 16].map((n) => ({ value: String(n), label: `${n}px` }))}
              onChange={(n) => set({ fontSize: Number(n) })}
            />
          </Row>
          <div className="grid grid-cols-1 gap-y-2">
            <CheckLabel label="Mostrar etiquetas" checked={settings.showLabels} onChange={(showLabels) => set({ showLabels })} />
            <CheckLabel label="Modo compacto de estadísticas" checked={settings.compactStats} onChange={(compactStats) => set({ compactStats })} />
            <CheckLabel label="Mostrar siempre las estadísticas" checked={settings.alwaysShowStats} onChange={(alwaysShowStats) => set({ alwaysShowStats })} />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-tv-border pt-3">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => set({ ...(positionDefaults ?? defaultPositionSettings()) })}
            className="text-tv-text-muted hover:text-tv-text"
            title="Volver a la configuración predeterminada"
          >
            Restablecer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPositionDefaults(settings)}
            className="text-tv-text-muted hover:text-tv-text"
            title="Las próximas posiciones usarán esta configuración"
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
              if (o) {
                updatePosition(position.id, {
                  entry: o.entry,
                  tp: o.tp,
                  sl: o.sl,
                  endTime: o.endTime,
                  settings: o.settings,
                  locked: o.locked,
                });
              }
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
