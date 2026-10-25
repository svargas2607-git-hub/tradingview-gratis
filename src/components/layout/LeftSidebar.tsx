"use client";

import { MousePointer2, Minus, Ruler, Trash2, Lock, Magnet, Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChartStore, type DrawingTool, type MagnetMode } from "@/lib/store/chart-store";
import { cn } from "@/lib/utils";

interface ToolDef {
  key: DrawingTool;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
}

// lucide has no Fibonacci icons — drawn in the same 24px stroke style
function TrendLineIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className}>
      <path d="M6.5 17.5 17.5 6.5" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="5" r="2" />
    </svg>
  );
}

function FibRetracementIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className}>
      <path d="M3 4h18M3 9.5h18M3 14.5h18M3 20h18" />
      <path d="M5 20 19 4" strokeDasharray="2 2.5" strokeWidth={1.5} />
    </svg>
  );
}

function FibExtensionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className}>
      <path d="M11 4h10M11 9.5h10M11 14.5h10" />
      <path d="M3 20 8 8l3 6.5" strokeWidth={1.5} />
      <circle cx="3" cy="20" r="1" fill="currentColor" />
    </svg>
  );
}

// Position box: profit zone with an arrow, split at the entry line
function LongPositionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <path d="M3 14h18" />
      <path d="m8 10 3-3 2 2 3-3" strokeWidth={1.5} />
    </svg>
  );
}

function ShortPositionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <path d="M3 10h18" />
      <path d="m8 14 3 3 2-2 3 3" strokeWidth={1.5} />
    </svg>
  );
}

// Elliott impulse: five-wave zigzag (1 up, 2 down, 3 up, 4 down, 5 up)
function ElliottImpulseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 20 7 11l3 4 6-11 2 6 4-4" />
    </svg>
  );
}

// Elliott correction: A down, B up, C down
function ElliottCorrectionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 5 9 18l4-7 8 9" />
    </svg>
  );
}

function RectangleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" className={className}>
      <rect x="4" y="6" width="16" height="12" rx="1" />
    </svg>
  );
}

const TOOLS: ToolDef[] = [
  { key: "cursor", icon: MousePointer2, label: "Cursor", hint: "Modo navegación" },
  {
    key: "hline",
    icon: Minus,
    label: "Línea horizontal",
    hint: "Click en el chart para marcar un precio",
  },
  {
    key: "trendLine",
    icon: TrendLineIcon,
    label: "Línea de tendencia",
    hint: "Click en dos puntos o arrastrá · Esc cancela",
  },
  {
    key: "rectangle",
    icon: RectangleIcon,
    label: "Rectángulo",
    hint: "Click en dos esquinas opuestas · Esc cancela",
  },
  {
    key: "measure",
    icon: Ruler,
    label: "Regla / Medir",
    hint: "Click en dos puntos para medir Δ precio, %, barras y volumen",
  },
  {
    key: "fibRetracement",
    icon: FibRetracementIcon,
    label: "Retroceso de Fibonacci",
    hint: "Click en el inicio y el fin del movimiento · Esc cancela",
  },
  {
    key: "fibExtension",
    icon: FibExtensionIcon,
    label: "Extensión de Fibonacci",
    hint: "Click en A, B y el retroceso C · Esc cancela",
  },
  {
    key: "elliottImpulse",
    icon: ElliottImpulseIcon,
    label: "Onda de impulso de Elliott (12345)",
    hint: "Click en los 6 puntos: 0, 1, 2, 3, 4 y 5 · Esc cancela",
  },
  {
    key: "elliottCorrection",
    icon: ElliottCorrectionIcon,
    label: "Onda de corrección de Elliott (ABC)",
    hint: "Click en los 4 puntos: 0, A, B y C · Esc cancela",
  },
  {
    key: "longPosition",
    icon: LongPositionIcon,
    label: "Posición larga",
    hint: "Click en el precio de entrada · Arrastrá el objetivo, el stop y el ancho",
  },
  {
    key: "shortPosition",
    icon: ShortPositionIcon,
    label: "Posición corta",
    hint: "Click en el precio de entrada · Arrastrá el objetivo, el stop y el ancho",
  },
];

// Strong magnet: same magnet with filled poles
function StrongMagnetIcon({ className }: { className?: string }) {
  return <Magnet className={className} fill="currentColor" fillOpacity={0.35} />;
}

const MAGNET_MODES: {
  key: MagnetMode;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}[] = [
  { key: "weak", icon: Magnet, label: "Imán débil", hint: "Se pega al OHLC solo si estás cerca" },
  { key: "strong", icon: StrongMagnetIcon, label: "Imán fuerte", hint: "Siempre se pega al OHLC más cercano" },
];

function MagnetButton() {
  const magnet = useChartStore((s) => s.magnet);
  const magnetMode = useChartStore((s) => s.magnetMode);
  const setMagnet = useChartStore((s) => s.setMagnet);
  const setMagnetMode = useChartStore((s) => s.setMagnetMode);
  const current = MAGNET_MODES.find((m) => m.key === magnetMode) ?? MAGNET_MODES[0];
  const Icon = current.icon;

  return (
    <div className="group relative">
      <Tooltip>
        <TooltipTrigger
          onClick={() => setMagnet(!magnet)}
          aria-label="Modo imán"
          aria-pressed={magnet}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-tv-panel-hover",
            magnet ? "bg-tv-blue/15 text-tv-blue" : "text-tv-text-muted hover:text-tv-text",
          )}
        >
          <Icon className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <div className="font-medium">
            Modo imán · {current.label} {magnet ? "(activado)" : "(desactivado)"}
          </div>
          <div className="mt-0.5 text-[10px] text-tv-text-muted">
            Los dibujos se pegan al OHLC de la vela · Mantener Ctrl lo invierte
          </div>
        </TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Elegir modo imán"
          className="absolute -right-1 bottom-0 flex h-4 w-2.5 items-end justify-center text-tv-text-muted opacity-0 transition-opacity hover:text-tv-text group-hover:opacity-100 data-popup-open:opacity-100"
        >
          <svg viewBox="0 0 4 4" className="mb-0.5 h-1.5 w-1.5" fill="currentColor">
            <path d="M4 0v4H0z" />
          </svg>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-56 bg-tv-panel">
          {MAGNET_MODES.map((m) => {
            const ModeIcon = m.icon;
            return (
              <DropdownMenuItem
                key={m.key}
                onClick={() => setMagnetMode(m.key)}
                className="flex items-center gap-2 text-xs"
              >
                <ModeIcon className="h-4 w-4" />
                <div className="flex-1">
                  <div>{m.label}</div>
                  <div className="text-[10px] text-tv-text-muted">{m.hint}</div>
                </div>
                {magnet && magnetMode === m.key && <Check className="h-3.5 w-3.5 text-tv-blue" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const LOCKED = [
  { label: "Texto" },
];

export function LeftSidebar() {
  const tool = useChartStore((s) => s.tool);
  const setTool = useChartStore((s) => s.setTool);
  const clearPriceLines = useChartStore((s) => s.clearPriceLines);
  const clearFibs = useChartStore((s) => s.clearFibs);
  const clearTrendLines = useChartStore((s) => s.clearTrendLines);
  const clearPositions = useChartStore((s) => s.clearPositions);
  const clearElliotts = useChartStore((s) => s.clearElliotts);
  const clearRectangles = useChartStore((s) => s.clearRectangles);
  const symbol = useChartStore((s) => s.symbol);

  return (
    <aside className="flex w-11 flex-col items-center gap-0.5 border-r border-tv-border bg-tv-panel py-1.5">
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const active = tool === t.key;
        return (
          <Tooltip key={t.key}>
            <TooltipTrigger
              onClick={() => setTool(t.key)}
              aria-label={t.label}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-tv-panel-hover",
                active
                  ? "bg-tv-blue/15 text-tv-blue"
                  : "text-tv-text-muted hover:text-tv-text",
              )}
            >
              <Icon className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              <div className="font-medium">{t.label}</div>
              {t.hint && (
                <div className="mt-0.5 text-[10px] text-tv-text-muted">{t.hint}</div>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}

      <div className="my-1 h-px w-6 bg-tv-border" />

      <MagnetButton />

      <Tooltip>
        <TooltipTrigger
          onClick={() => {
            clearPriceLines(symbol);
            clearFibs(symbol);
            clearTrendLines(symbol);
            clearPositions(symbol);
            clearElliotts(symbol);
            clearRectangles(symbol);
          }}
          aria-label="Borrar dibujos"
          className="flex h-8 w-8 items-center justify-center rounded text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-red"
        >
          <Trash2 className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <div className="font-medium">Borrar dibujos</div>
          <div className="mt-0.5 text-[10px] text-tv-text-muted">
            Limpia las líneas, tendencias, Fibonacci, posiciones, ondas de Elliott y rectángulos de este símbolo
          </div>
        </TooltipContent>
      </Tooltip>

      <div className="my-1 h-px w-6 bg-tv-border" />

      {LOCKED.map((t) => (
        <Tooltip key={t.label}>
          <TooltipTrigger
            disabled
            aria-label={t.label}
            className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded text-tv-text-dim opacity-40"
          >
            <Lock className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            <div className="font-medium">{t.label}</div>
            <div className="mt-0.5 text-[10px] text-tv-yellow">
              Próximamente · video 3
            </div>
          </TooltipContent>
        </Tooltip>
      ))}
    </aside>
  );
}
