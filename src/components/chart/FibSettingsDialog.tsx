"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useChartStore, type FibDrawing } from "@/lib/store/chart-store";
import {
  cloneFibSettings,
  defaultFibSettings,
  fibSettingsOf,
  type FibLevelDef,
  type FibLineStyle,
  type FibSettings,
} from "@/lib/fibonacci";
import { cn } from "@/lib/utils";

const TITLES = {
  retracement: "Retroceso de Fibonacci",
  extension: "Extensión de Fibonacci basada en tendencia",
} as const;

const POINT_NAMES = ["Punto 1 (A)", "Punto 2 (B)", "Punto 3 (C)"];

export const LINE_STYLES: { value: FibLineStyle; label: string }[] = [
  { value: "solid", label: "Sólida" },
  { value: "dashed", label: "Guiones" },
  { value: "dotted", label: "Puntos" },
];

/**
 * Settings for one Fibonacci drawing. Changes apply live (like TradingView);
 * "Cancelar" restores the drawing as it was when the dialog opened.
 */
export function FibSettingsDialog() {
  const targetId = useChartStore((s) => s.fibSettingsTarget);
  const setTarget = useChartStore((s) => s.setFibSettingsTarget);
  const fib = useChartStore((s) => s.fibs.find((f) => f.id === targetId) ?? null);

  return (
    <Dialog
      open={fib !== null}
      onOpenChange={(v) => {
        if (!v) setTarget(null);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto bg-tv-panel sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {fib ? TITLES[fib.kind] : ""}
          </DialogTitle>
        </DialogHeader>
        {fib && <SettingsBody key={fib.id} fib={fib} onClose={() => setTarget(null)} />}
      </DialogContent>
    </Dialog>
  );
}

function SettingsBody({ fib, onClose }: { fib: FibDrawing; onClose: () => void }) {
  const updateFib = useChartStore((s) => s.updateFib);
  const setFibDefaults = useChartStore((s) => s.setFibDefaults);
  const fibDefaults = useChartStore((s) => s.fibDefaults);
  const settings = fibSettingsOf(fib);

  // Snapshot to restore on "Cancelar"
  const original = useRef<FibDrawing | null>(null);
  useEffect(() => {
    original.current = {
      ...fib,
      points: fib.points.map((p) => ({ ...p })),
      settings: cloneFibSettings(settings),
    };
    // Only when the dialog opens for this drawing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (patch: Partial<FibSettings>) =>
    updateFib(fib.id, { settings: { ...settings, ...patch } });
  const setLevel = (i: number, patch: Partial<FibLevelDef>) =>
    set({ levels: settings.levels.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  return (
    <div className="flex flex-col gap-3 text-xs">
      <Tabs defaultValue="style">
        <TabsList variant="line" className="w-full justify-start border-b border-tv-border">
          <TabsTrigger value="style" className="flex-none text-xs">Estilo</TabsTrigger>
          <TabsTrigger value="coords" className="flex-none text-xs">Coordenadas</TabsTrigger>
        </TabsList>

        <TabsContent value="style" className="flex flex-col gap-4 pt-2">
          <Row label="Línea de tendencia">
            <Check
              checked={settings.trendLine.visible}
              onChange={(visible) => set({ trendLine: { ...settings.trendLine, visible } })}
            />
            <ColorInput
              value={settings.trendLine.color}
              onChange={(color) => set({ trendLine: { ...settings.trendLine, color } })}
            />
            <Select
              value={settings.trendLine.style}
              options={LINE_STYLES}
              onChange={(style) => set({ trendLine: { ...settings.trendLine, style } })}
            />
          </Row>

          <Row label="Líneas de niveles">
            <Select
              value={String(settings.levelsLine.width)}
              options={[1, 2, 3, 4].map((w) => ({ value: String(w), label: `${w}px` }))}
              onChange={(w) => set({ levelsLine: { ...settings.levelsLine, width: Number(w) } })}
            />
            <Select
              value={settings.levelsLine.style}
              options={LINE_STYLES}
              onChange={(style) => set({ levelsLine: { ...settings.levelsLine, style } })}
            />
          </Row>

          <div>
            <SectionTitle>Niveles</SectionTitle>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {settings.levels.map((l, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Check checked={l.enabled} onChange={(enabled) => setLevel(i, { enabled })} />
                  <LevelInput value={l.ratio} onChange={(ratio) => setLevel(i, { ratio })} />
                  <ColorInput value={l.color} onChange={(color) => setLevel(i, { color })} />
                  <button
                    onClick={() => set({ levels: settings.levels.filter((_, j) => j !== i) })}
                    title="Quitar nivel"
                    aria-label="Quitar nivel"
                    className="rounded p-0.5 text-tv-text-dim hover:bg-tv-panel-hover hover:text-tv-red"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const max = Math.max(0, ...settings.levels.map((l) => l.ratio));
                set({
                  levels: [
                    ...settings.levels,
                    { ratio: +(max + 0.5).toFixed(3), color: "#2962ff", enabled: true },
                  ],
                });
              }}
              className="mt-2 flex items-center gap-1 text-tv-blue hover:underline"
            >
              <Plus className="h-3 w-3" /> Agregar nivel
            </button>
          </div>

          <Row label="Usar un color">
            <Check
              checked={settings.oneColor !== null}
              onChange={(on) => set({ oneColor: on ? "#2962ff" : null })}
            />
            {settings.oneColor !== null && (
              <ColorInput value={settings.oneColor} onChange={(oneColor) => set({ oneColor })} />
            )}
          </Row>

          <Row label="Fondo">
            <Check checked={settings.background} onChange={(background) => set({ background })} />
            <input
              type="range"
              min={0}
              max={100}
              value={settings.backgroundOpacity}
              disabled={!settings.background}
              onChange={(e) => set({ backgroundOpacity: Number(e.target.value) })}
              className="w-28 accent-tv-blue"
            />
            <span className="w-8 tabular-nums text-tv-text-muted">{settings.backgroundOpacity}%</span>
          </Row>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <CheckLabel label="Extender a la izquierda" checked={settings.extendLeft} onChange={(extendLeft) => set({ extendLeft })} />
            <CheckLabel label="Extender a la derecha" checked={settings.extendRight} onChange={(extendRight) => set({ extendRight })} />
            <CheckLabel label="Invertir" checked={settings.reverse} onChange={(reverse) => set({ reverse })} />
            <CheckLabel label="Precios" checked={settings.showPrices} onChange={(showPrices) => set({ showPrices })} />
            <CheckLabel label="Niveles" checked={settings.showLevels} onChange={(showLevels) => set({ showLevels })} />
          </div>

          <Row label="Formato de niveles">
            <Select
              value={settings.levelsAsPercent ? "percent" : "values"}
              options={[
                { value: "values", label: "Valores" },
                { value: "percent", label: "Porcentajes" },
              ]}
              onChange={(v) => set({ levelsAsPercent: v === "percent" })}
            />
          </Row>

          <Row label="Etiquetas">
            <Select
              value={settings.labelSide}
              options={[
                { value: "left", label: "Izquierda" },
                { value: "right", label: "Derecha" },
              ]}
              onChange={(labelSide) => set({ labelSide })}
            />
            <Select
              value={settings.labelVertical ?? "middle"}
              options={[
                { value: "top", label: "Arriba" },
                { value: "middle", label: "Centro" },
                { value: "bottom", label: "Abajo" },
              ]}
              onChange={(labelVertical) => set({ labelVertical })}
            />
            <Select
              value={String(settings.fontSize)}
              options={[8, 10, 11, 12, 14, 16].map((n) => ({ value: String(n), label: `${n}px` }))}
              onChange={(n) => set({ fontSize: Number(n) })}
            />
          </Row>
        </TabsContent>

        <TabsContent value="coords" className="flex flex-col gap-3 pt-2">
          {fib.points.map((p, i) => (
            <Row key={i} label={POINT_NAMES[i]}>
              <LevelInput
                value={p.price}
                wide
                onChange={(price) =>
                  updateFib(fib.id, {
                    points: fib.points.map((q, j) => (j === i ? { ...q, price } : q)),
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
          <CheckLabel
            label="Bloquear (no se puede mover)"
            checked={!!fib.locked}
            onChange={(locked) => updateFib(fib.id, { locked })}
          />
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-tv-border pt-3">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => set(cloneFibSettings(fibDefaults[fib.kind] ?? defaultFibSettings(fib.kind)))}
            className="text-tv-text-muted hover:text-tv-text"
            title="Volver al estilo predeterminado"
          >
            Restablecer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFibDefaults(fib.kind, settings)}
            className="text-tv-text-muted hover:text-tv-text"
            title="Los próximos Fibonacci de este tipo usarán este estilo"
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
              if (o) updateFib(fib.id, { points: o.points, settings: o.settings, locked: o.locked });
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

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
      {children}
    </div>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-32 shrink-0 text-tv-text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Check({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-3.5 w-3.5 shrink-0 accent-tv-blue"
    />
  );
}

export function CheckLabel({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-tv-text">
      <Check checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-5 w-6 shrink-0 cursor-pointer rounded border border-tv-border bg-transparent p-0"
    />
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-6 rounded border border-tv-border bg-tv-bg px-1.5 text-xs text-tv-text outline-none focus:border-tv-blue"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Number field that keeps the raw text while typing ("0.", "-", "1.6") and
 * only reports parsed values, so partial input doesn't get overwritten.
 */
export function LevelInput({
  value,
  onChange,
  wide,
}: {
  value: number;
  onChange: (n: number) => void;
  wide?: boolean;
}) {
  const [text, setText] = useState(String(value));
  // Resync when the value changes from outside (reset, cancel, drag)
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    if (parseFloat(text) !== value) setText(String(value));
  }
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".");
        setText(raw);
        const n = parseFloat(raw);
        if (!isNaN(n) && isFinite(n)) onChange(n);
      }}
      onBlur={() => setText(String(value))}
      className={cn(
        "h-6 rounded border border-tv-border bg-tv-bg px-1.5 text-xs tabular-nums text-tv-text outline-none focus:border-tv-blue",
        wide ? "w-28" : "w-16",
      )}
    />
  );
}
