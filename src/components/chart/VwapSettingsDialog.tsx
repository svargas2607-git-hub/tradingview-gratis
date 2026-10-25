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
  defaultVwapSettings,
  type VwapAnchor,
  type VwapBand,
  type VwapBandsMode,
  type VwapLineStyle,
  type VwapSettings,
  type VwapSource,
} from "@/lib/vwap";
import { Check, CheckLabel, ColorInput, Row, Select } from "./FibSettingsDialog";

export const VWAP_ANCHORS: { value: VwapAnchor; label: string }[] = [
  { value: "session", label: "Sesión" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "year", label: "Año" },
  { value: "decade", label: "Década" },
  { value: "century", label: "Siglo" },
];

const SOURCES: { value: VwapSource; label: string }[] = [
  { value: "open", label: "Apertura (O)" },
  { value: "high", label: "Máximo (H)" },
  { value: "low", label: "Mínimo (L)" },
  { value: "close", label: "Cierre (C)" },
  { value: "hl2", label: "HL2" },
  { value: "hlc3", label: "HLC3" },
  { value: "ohlc4", label: "OHLC4" },
  { value: "hlcc4", label: "HLCC4" },
];

const BANDS_MODES: { value: VwapBandsMode; label: string }[] = [
  { value: "stdev", label: "Desviación estándar" },
  { value: "percent", label: "Porcentaje" },
];

const STYLES: { value: VwapLineStyle; label: string }[] = [
  { value: "solid", label: "Continua" },
  { value: "dashed", label: "Guiones" },
  { value: "dotted", label: "Puntos" },
];

/**
 * Settings of the VWAP indicator. Changes apply live (like TradingView);
 * "Cancelar" restores the settings as they were when the dialog opened.
 */
export function VwapSettingsDialog() {
  const target = useChartStore((s) => s.settingsTarget);
  const setTarget = useChartStore((s) => s.setSettingsTarget);

  return (
    <Dialog
      open={target === "vwap"}
      onOpenChange={(v) => {
        if (!v) setTarget(null);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto bg-tv-panel sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Precio medio ponderado por volumen (VWAP) — Configuración
          </DialogTitle>
        </DialogHeader>
        {target === "vwap" && <SettingsBody onClose={() => setTarget(null)} />}
      </DialogContent>
    </Dialog>
  );
}

function SettingsBody({ onClose }: { onClose: () => void }) {
  const settings = useChartStore((s) => s.vwapSettings);
  const setVwapSettings = useChartStore((s) => s.setVwapSettings);

  // Snapshot to restore on "Cancelar"
  const original = useRef<VwapSettings | null>(null);
  useEffect(() => {
    original.current = { ...settings, bands: settings.bands.map((b) => ({ ...b })) as VwapSettings["bands"] };
    // Only when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (patch: Partial<VwapSettings>) => setVwapSettings(patch);
  const setBand = (i: number, patch: Partial<VwapBand>) =>
    set({
      bands: settings.bands.map((b, j) => (j === i ? { ...b, ...patch } : b)) as VwapSettings["bands"],
    });
  const num = (
    value: number,
    min: number,
    max: number,
    apply: (n: number) => void,
    float = false,
  ) => (
    <Input
      type="number"
      min={min}
      max={max}
      step={float ? 0.1 : 1}
      value={value}
      onChange={(e) => {
        const n = float ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
        if (!isNaN(n)) apply(Math.max(min, Math.min(max, n)));
      }}
      className="h-7 w-20 bg-tv-bg tabular-nums"
    />
  );
  const widths = [1, 2, 3, 4].map((w) => ({ value: String(w), label: `${w}px` }));
  const unit = settings.bandsMode === "stdev" ? "× desv." : "%";

  return (
    <div className="flex flex-col gap-3 text-xs">
      <Tabs defaultValue="inputs">
        <TabsList variant="line" className="w-full justify-start border-b border-tv-border">
          <TabsTrigger value="inputs" className="flex-none text-xs">Entradas</TabsTrigger>
          <TabsTrigger value="style" className="flex-none text-xs">Estilo</TabsTrigger>
        </TabsList>

        <TabsContent value="inputs" className="flex flex-col gap-4 pt-2">
          <Row label="Período de anclaje">
            <Select value={settings.anchor} options={VWAP_ANCHORS} onChange={(anchor) => set({ anchor })} />
          </Row>
          <Row label="Fuente">
            <Select value={settings.source} options={SOURCES} onChange={(source) => set({ source })} />
          </Row>
          <Row label="Desplazamiento">
            {num(settings.offset, -500, 500, (offset) => set({ offset }))}
            <span className="text-tv-text-muted">velas</span>
          </Row>
          <Row label="Ocultar en 1D o más">
            <Check checked={settings.hideOnDwm} onChange={(hideOnDwm) => set({ hideOnDwm })} />
          </Row>

          <Row label="Cálculo de bandas">
            <Select value={settings.bandsMode} options={BANDS_MODES} onChange={(bandsMode) => set({ bandsMode })} />
          </Row>
          {settings.bands.map((band, i) => (
            <Row key={i} label={`Multiplicador banda ${i + 1}`}>
              <Check checked={band.enabled} onChange={(enabled) => setBand(i, { enabled })} />
              {num(band.multiplier, 0.001, 100, (multiplier) => setBand(i, { multiplier }), true)}
              <span className="text-tv-text-muted">{unit}</span>
            </Row>
          ))}
        </TabsContent>

        <TabsContent value="style" className="flex flex-col gap-4 pt-2">
          <Row label="VWAP">
            <Check checked={settings.lineVisible} onChange={(lineVisible) => set({ lineVisible })} />
            <ColorInput value={settings.color} onChange={(color) => set({ color })} />
            <Select
              value={String(settings.width)}
              options={widths}
              onChange={(w) => set({ width: Number(w) })}
            />
            <Select value={settings.style} options={STYLES} onChange={(style) => set({ style })} />
          </Row>

          {settings.bands.map((band, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Row label={`Banda ${i + 1}`}>
                <span className="text-tv-text-muted">Sup.</span>
                <ColorInput value={band.upperColor} onChange={(upperColor) => setBand(i, { upperColor })} />
                <span className="text-tv-text-muted">Inf.</span>
                <ColorInput value={band.lowerColor} onChange={(lowerColor) => setBand(i, { lowerColor })} />
                {!band.enabled && <span className="text-tv-text-dim">(desactivada)</span>}
              </Row>
              <Row label="Relleno">
                <Check checked={band.fill} onChange={(fill) => setBand(i, { fill })} />
                <ColorInput value={band.fillColor} onChange={(fillColor) => setBand(i, { fillColor })} />
              </Row>
            </div>
          ))}

          <Row label="Líneas de bandas">
            <Select
              value={String(settings.bandWidth)}
              options={widths}
              onChange={(w) => set({ bandWidth: Number(w) })}
            />
            <Select value={settings.bandStyle} options={STYLES} onChange={(bandStyle) => set({ bandStyle })} />
          </Row>
          <Row label="Opacidad relleno">
            <input
              type="range"
              min={0}
              max={100}
              value={settings.fillOpacity}
              onChange={(e) => set({ fillOpacity: Number(e.target.value) })}
              className="h-1 w-24 cursor-pointer accent-tv-blue"
              aria-label="Opacidad del relleno"
            />
            <span className="w-9 text-right tabular-nums text-tv-text-muted">{settings.fillOpacity}%</span>
          </Row>

          <Row label="Salidas">
            <CheckLabel
              label="Etiquetas en escala de precio"
              checked={settings.labelsOnScale}
              onChange={(labelsOnScale) => set({ labelsOnScale })}
            />
          </Row>
          <Row label="">
            <CheckLabel
              label="Valor en la etiqueta del indicador"
              checked={settings.valuesInLabel}
              onChange={(valuesInLabel) => set({ valuesInLabel })}
            />
          </Row>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-tv-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => set(defaultVwapSettings())}
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
