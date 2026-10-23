"use client";

import { MousePointer2, Minus, Ruler, Trash2, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useChartStore, type DrawingTool } from "@/lib/store/chart-store";
import { cn } from "@/lib/utils";

interface ToolDef {
  key: DrawingTool;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
}

// lucide has no Fibonacci icons — drawn in the same 24px stroke style
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

const TOOLS: ToolDef[] = [
  { key: "cursor", icon: MousePointer2, label: "Cursor", hint: "Modo navegación" },
  {
    key: "hline",
    icon: Minus,
    label: "Línea horizontal",
    hint: "Click en el chart para marcar un precio",
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
];

const LOCKED = [
  { label: "Línea de tendencia" },
  { label: "Texto" },
];

export function LeftSidebar() {
  const tool = useChartStore((s) => s.tool);
  const setTool = useChartStore((s) => s.setTool);
  const clearPriceLines = useChartStore((s) => s.clearPriceLines);
  const clearFibs = useChartStore((s) => s.clearFibs);
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

      <Tooltip>
        <TooltipTrigger
          onClick={() => {
            clearPriceLines(symbol);
            clearFibs(symbol);
          }}
          aria-label="Borrar dibujos"
          className="flex h-8 w-8 items-center justify-center rounded text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-red"
        >
          <Trash2 className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <div className="font-medium">Borrar dibujos</div>
          <div className="mt-0.5 text-[10px] text-tv-text-muted">
            Limpia las líneas y Fibonacci de este símbolo
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
