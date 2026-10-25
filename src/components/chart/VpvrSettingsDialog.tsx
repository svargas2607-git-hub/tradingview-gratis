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
import { Input } from "@/components/ui/input";
import { useChartStore } from "@/lib/store/chart-store";
import {
  defaultVpvrSettings,
  type VpvrPlacement,
  type VpvrSettings,
  type VpvrVolumeMode,
} from "@/lib/vpvr";
import { Check, CheckLabel, ColorInput, Row, Select } from "./FibSettingsDialog";

const VOLUME_MODES: { value: VpvrVolumeMode; label: string }[] = [
  { value: "updown", label: "Arriba / Abajo" },
  { value: "total", label: "Total" },
];

const PLACEMENTS: { value: VpvrPlacement; label: string }[] = [
  { value: "left", label: "Izquierda" },
  { value: "right", label: "Derecha" },
];

/**
 * Settings of the VPVR indicator. Changes apply live (like TradingView);
 * "Cancelar" restores the settings as they were when the dialog opened.
 */
export function VpvrSettingsDialog() {
  const target = useChartStore((s) => s.settingsTarget);
  const setTarget = useChartStore((s) => s.setSettingsTarget);

  return (
    <Dialog
      open={target === "vpvr"}
      onOpenChange={(v) => {
        if (!v) setTarget(null);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto bg-tv-panel sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Perfil de volumen de rango visible — Configuración
          </DialogTitle>
        </DialogHeader>
        {target === "vpvr" && <SettingsBody onClose={() => setTarget(null)} />}
      </DialogContent>
    </Dialog>
  );
}

function LineRow({
  label,
  enabled,
  color,
  onEnabled,
  onColor,
}: {
  label: string;
  enabled: boolean;
  color: string;
  onEnabled: (v: boolean) => void;
  onColor: (v: string) => void;
}) {
  return (
    <Row label={label}>
      <Check checked={enabled} onChange={onEnabled} />
      <ColorInput value={color} onChange={onColor} />
    </Row>
  );
}

function SettingsBody({ onClose }: { onClose: () => void }) {
  const settings = useChartStore((s) => s.vpvrSettings);
  const setVpvrSettings = useChartStore((s) => s.setVpvrSettings);

  // Snapshot to restore on "Cancelar"
  const original = useRef<VpvrSettings | null>(null);
  useEffect(() => {
    original.current = { ...settings };
    // Only when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (patch: Partial<VpvrSettings>) => setVpvrSettings(patch);
  const num = (value: number, min: number, max: number, apply: (n: number) => void) => (
    <Input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => {
        const n = parseInt(e.target.value, 10);
        if (!isNaN(n)) apply(Math.max(min, Math.min(max, n)));
      }}
      className="h-7 w-20 bg-tv-bg tabular-nums"
    />
  );
  const widths = [1, 2, 3, 4].map((w) => ({ value: String(w), label: `${w}px` }));

  return (
    <div className="flex flex-col gap-3 text-xs">
      <Tabs defaultValue="inputs">
        <TabsList variant="line" className="w-full justify-start border-b border-tv-border">
          <TabsTrigger value="inputs" className="flex-none text-xs">Entradas</TabsTrigger>
          <TabsTrigger value="style" className="flex-none text-xs">Estilo</TabsTrigger>
        </TabsList>

        <TabsContent value="inputs" className="flex flex-col gap-4 pt-2">
          <Row label="Número de filas">{num(settings.rows, 2, 500, (rows) => set({ rows }))}</Row>
          <Row label="Volumen">
            <Select
              value={settings.volumeMode}
              options={VOLUME_MODES}
              onChange={(volumeMode) => set({ volumeMode })}
            />
          </Row>
          <Row label="Área de valor">
            {num(settings.valueAreaPct, 1, 100, (valueAreaPct) => set({ valueAreaPct }))}
            <span className="text-tv-text-muted">% del volumen</span>
          </Row>
          <Row label="Ubicación">
            <Select
              value={settings.placement}
              options={PLACEMENTS}
              onChange={(placement) => set({ placement })}
            />
          </Row>
          <Row label="Ancho">
            <input
              type="range"
              min={10}
              max={100}
              value={settings.widthPct}
              onChange={(e) => set({ widthPct: Number(e.target.value) })}
              className="h-1 w-24 cursor-pointer accent-tv-blue"
              aria-label="Ancho del perfil"
            />
            <span className="w-9 text-right tabular-nums text-tv-text-muted">{settings.widthPct}%</span>
          </Row>
        </TabsContent>

        <TabsContent value="style" className="flex flex-col gap-4 pt-2">
          <Row label="Volumen">
            <ColorInput value={settings.upColor} onChange={(upColor) => set({ upColor })} />
            {settings.volumeMode === "updown" && (
              <ColorInput value={settings.downColor} onChange={(downColor) => set({ downColor })} />
            )}
            <span className="text-tv-text-muted">
              {settings.volumeMode === "updown" ? "Arriba / Abajo" : "Total"}
            </span>
          </Row>
          <Row label="Área de valor">
            <ColorInput value={settings.vaUpColor} onChange={(vaUpColor) => set({ vaUpColor })} />
            {settings.volumeMode === "updown" && (
              <ColorInput value={settings.vaDownColor} onChange={(vaDownColor) => set({ vaDownColor })} />
            )}
          </Row>
          <Row label="Opacidad">
            <input
              type="range"
              min={5}
              max={100}
              value={settings.opacity}
              onChange={(e) => set({ opacity: Number(e.target.value) })}
              className="h-1 w-24 cursor-pointer accent-tv-blue"
              aria-label="Opacidad del histograma"
            />
            <span className="w-9 text-right tabular-nums text-tv-text-muted">{settings.opacity}%</span>
          </Row>
          <LineRow
            label="Caja del histograma"
            enabled={settings.histogramBox}
            color={settings.boxColor}
            onEnabled={(histogramBox) => set({ histogramBox })}
            onColor={(boxColor) => set({ boxColor })}
          />

          <Row label="POC">
            <Check checked={settings.poc} onChange={(poc) => set({ poc })} />
            <ColorInput value={settings.pocColor} onChange={(pocColor) => set({ pocColor })} />
            <Select
              value={String(settings.pocWidth)}
              options={widths}
              onChange={(w) => set({ pocWidth: Number(w) })}
            />
            <CheckLabel
              label="Extender"
              checked={settings.pocExtend}
              onChange={(pocExtend) => set({ pocExtend })}
            />
          </Row>
          <LineRow
            label="POC en desarrollo"
            enabled={settings.developingPoc}
            color={settings.developingPocColor}
            onEnabled={(developingPoc) => set({ developingPoc })}
            onColor={(developingPocColor) => set({ developingPocColor })}
          />
          <LineRow
            label="VAH (máx. área valor)"
            enabled={settings.vah}
            color={settings.vahColor}
            onEnabled={(vah) => set({ vah })}
            onColor={(vahColor) => set({ vahColor })}
          />
          <LineRow
            label="VAL (mín. área valor)"
            enabled={settings.val}
            color={settings.valColor}
            onEnabled={(val) => set({ val })}
            onColor={(valColor) => set({ valColor })}
          />
          <Row label="Grosor VAH / VAL">
            <Select
              value={String(settings.vaLineWidth)}
              options={widths}
              onChange={(w) => set({ vaLineWidth: Number(w) })}
            />
          </Row>
          <LineRow
            label="Valores"
            enabled={settings.values}
            color={settings.valuesColor}
            onEnabled={(values) => set({ values })}
            onColor={(valuesColor) => set({ valuesColor })}
          />
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-tv-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => set(defaultVpvrSettings())}
          className="text-tv-text-muted hover:text-tv-text"
          title="Volver a los valores predeterminados"
        >
          Restablecer
        </Button>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (original.current) set(original.current);
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
