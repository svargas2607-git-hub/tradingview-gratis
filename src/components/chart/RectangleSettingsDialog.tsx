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
import { cn } from "@/lib/utils";
import { useChartStore, type RectangleDrawing } from "@/lib/store/chart-store";
import {
  RECTANGLE_PRESET_COLORS,
  defaultRectangleSettings,
  rectangleSettingsOf,
  type RectangleHAlign,
  type RectangleSettings,
  type RectangleVAlign,
} from "@/lib/rectangle";
import {
  Check,
  CheckLabel,
  ColorInput,
  LevelInput,
  LINE_STYLES,
  Row,
  Select,
} from "./FibSettingsDialog";

const H_ALIGN: { value: RectangleHAlign; label: string }[] = [
  { value: "left", label: "Izquierda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Derecha" },
];

const V_ALIGN: { value: RectangleVAlign; label: string }[] = [
  { value: "top", label: "Arriba" },
  { value: "middle", label: "Medio" },
  { value: "bottom", label: "Abajo" },
];

/**
 * Settings for one rectangle. Changes apply live (like TradingView);
 * "Cancelar" restores the rectangle as it was when the dialog opened.
 */
export function RectangleSettingsDialog() {
  const targetId = useChartStore((s) => s.rectangleSettingsTarget);
  const setTarget = useChartStore((s) => s.setRectangleSettingsTarget);
  const rect = useChartStore((s) => s.rectangles.find((r) => r.id === targetId) ?? null);

  return (
    <Dialog
      open={rect !== null}
      onOpenChange={(v) => {
        if (!v) setTarget(null);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto bg-tv-panel sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Rectángulo</DialogTitle>
        </DialogHeader>
        {rect && <SettingsBody key={rect.id} rect={rect} onClose={() => setTarget(null)} />}
      </DialogContent>
    </Dialog>
  );
}

function SettingsBody({ rect, onClose }: { rect: RectangleDrawing; onClose: () => void }) {
  const updateRectangle = useChartStore((s) => s.updateRectangle);
  const setRectangleDefaults = useChartStore((s) => s.setRectangleDefaults);
  const rectangleDefaults = useChartStore((s) => s.rectangleDefaults);
  const settings = rectangleSettingsOf(rect);

  // Snapshot to restore on "Cancelar"
  const original = useRef<RectangleDrawing | null>(null);
  useEffect(() => {
    original.current = {
      ...rect,
      points: rect.points.map((p) => ({ ...p })),
      settings: { ...settings },
    };
    // Only when the dialog opens for this drawing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (patch: Partial<RectangleSettings>) =>
    updateRectangle(rect.id, { settings: { ...settings, ...patch } });

  const widths = [1, 2, 3, 4].map((w) => ({ value: String(w), label: `${w}px` }));

  return (
    <div className="flex flex-col gap-3 text-xs">
      <Tabs defaultValue="style">
        <TabsList variant="line" className="w-full justify-start border-b border-tv-border">
          <TabsTrigger value="style" className="flex-none text-xs">Estilo</TabsTrigger>
          <TabsTrigger value="text" className="flex-none text-xs">Texto</TabsTrigger>
          <TabsTrigger value="coords" className="flex-none text-xs">Coordenadas</TabsTrigger>
        </TabsList>

        <TabsContent value="style" className="flex flex-col gap-4 pt-2">
          <Row label="Color">
            <div className="flex flex-wrap gap-1.5">
              {RECTANGLE_PRESET_COLORS.map(({ color, label }) => (
                <button
                  key={color}
                  type="button"
                  title={label}
                  aria-label={label}
                  // One click recolors border, background, middle line and text
                  onClick={() =>
                    set({
                      borderColor: color,
                      backgroundColor: color,
                      middleColor: color,
                      textColor: color,
                    })
                  }
                  style={{ backgroundColor: color }}
                  className={cn(
                    "h-5 w-5 rounded-sm border border-tv-border",
                    settings.borderColor === color && "ring-2 ring-tv-blue ring-offset-1 ring-offset-tv-panel",
                  )}
                />
              ))}
            </div>
          </Row>

          <Row label="Borde">
            <Check checked={settings.border} onChange={(border) => set({ border })} />
            <ColorInput value={settings.borderColor} onChange={(borderColor) => set({ borderColor })} />
            <Select
              value={String(settings.borderWidth)}
              options={widths}
              onChange={(w) => set({ borderWidth: Number(w) })}
            />
            <Select
              value={settings.borderStyle}
              options={LINE_STYLES}
              onChange={(borderStyle) => set({ borderStyle })}
            />
          </Row>

          <Row label="Fondo">
            <Check checked={settings.background} onChange={(background) => set({ background })} />
            <ColorInput
              value={settings.backgroundColor}
              onChange={(backgroundColor) => set({ backgroundColor })}
            />
            <input
              type="range"
              min={0}
              max={100}
              value={settings.backgroundOpacity}
              onChange={(e) => set({ backgroundOpacity: Number(e.target.value) })}
              className="h-1 w-24 cursor-pointer accent-tv-blue"
              aria-label="Opacidad del fondo"
            />
            <span className="w-9 text-right tabular-nums text-tv-text-muted">
              {settings.backgroundOpacity}%
            </span>
          </Row>

          <Row label="Línea media">
            <Check checked={settings.middleLine} onChange={(middleLine) => set({ middleLine })} />
            <ColorInput value={settings.middleColor} onChange={(middleColor) => set({ middleColor })} />
            <Select
              value={String(settings.middleWidth)}
              options={widths}
              onChange={(w) => set({ middleWidth: Number(w) })}
            />
            <Select
              value={settings.middleStyle}
              options={LINE_STYLES}
              onChange={(middleStyle) => set({ middleStyle })}
            />
          </Row>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <CheckLabel label="Extender a la izquierda" checked={settings.extendLeft} onChange={(extendLeft) => set({ extendLeft })} />
            <CheckLabel label="Extender a la derecha" checked={settings.extendRight} onChange={(extendRight) => set({ extendRight })} />
            <CheckLabel label="Etiquetas de precio" checked={settings.priceLabels} onChange={(priceLabels) => set({ priceLabels })} />
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
          <Row label="Texto">
            <ColorInput value={settings.textColor} onChange={(textColor) => set({ textColor })} />
            <Select
              value={String(settings.fontSize)}
              options={[10, 11, 12, 14, 16, 20, 24, 32].map((n) => ({ value: String(n), label: `${n}px` }))}
              onChange={(n) => set({ fontSize: Number(n) })}
            />
            <CheckLabel label="Negrita" checked={settings.bold} onChange={(bold) => set({ bold })} />
            <CheckLabel label="Cursiva" checked={settings.italic} onChange={(italic) => set({ italic })} />
          </Row>
          <Row label="Alineación horizontal">
            <Select value={settings.textHAlign} options={H_ALIGN} onChange={(textHAlign) => set({ textHAlign })} />
          </Row>
          <Row label="Alineación vertical">
            <Select value={settings.textVAlign} options={V_ALIGN} onChange={(textVAlign) => set({ textVAlign })} />
          </Row>
        </TabsContent>

        <TabsContent value="coords" className="flex flex-col gap-3 pt-2">
          {rect.points.map((p, i) => (
            <Row key={i} label={`Punto ${i + 1}`}>
              <LevelInput
                value={p.price}
                wide
                price
                onChange={(price) =>
                  updateRectangle(rect.id, {
                    points: rect.points.map((q, j) => (j === i ? { ...q, price } : q)),
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
              checked={!!rect.locked}
              onChange={(locked) => updateRectangle(rect.id, { locked })}
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
            // Text is per rectangle, not part of the style
            onClick={() => set({ ...(rectangleDefaults ?? defaultRectangleSettings()), text: settings.text })}
            className="text-tv-text-muted hover:text-tv-text"
            title="Volver al estilo predeterminado"
          >
            Restablecer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRectangleDefaults({ ...settings, text: "" })}
            className="text-tv-text-muted hover:text-tv-text"
            title="Los próximos rectángulos usarán este estilo"
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
              if (o) updateRectangle(rect.id, { points: o.points, settings: o.settings, locked: o.locked });
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
