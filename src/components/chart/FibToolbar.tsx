"use client";

import { Copy, Lock, LockOpen, Settings, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  x: number;
  y: number;
  locked: boolean;
  /** Missing for drawings without a settings dialog (hides the gear) */
  onSettings?: () => void;
  onToggleLock: () => void;
  onClone: () => void;
  onRemove: () => void;
}

/** Floating toolbar shown above the selected Fibonacci drawing */
export function FibToolbar({ x, y, locked, onSettings, onToggleLock, onClone, onRemove }: Props) {
  const btn =
    "rounded p-1 text-tv-text-muted transition-colors hover:bg-tv-panel-hover hover:text-tv-text";
  return (
    <div
      style={{ left: x, top: y }}
      // Keep clicks on the toolbar from reaching the chart (deselect / pan)
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute z-30 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-md bg-tv-panel p-0.5 shadow-lg ring-1 ring-tv-border"
    >
      {onSettings && (
        <button onClick={onSettings} title="Configuración" aria-label="Configuración" className={btn}>
          <Settings className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={onToggleLock}
        title={locked ? "Desbloquear" : "Bloquear"}
        aria-label={locked ? "Desbloquear" : "Bloquear"}
        className={cn(btn, locked && "text-tv-blue")}
      >
        {locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
      </button>
      <button onClick={onClone} title="Clonar" aria-label="Clonar" className={btn}>
        <Copy className="h-3.5 w-3.5" />
      </button>
      <div className="mx-0.5 h-4 w-px bg-tv-border" />
      <button
        onClick={onRemove}
        title="Eliminar (Supr)"
        aria-label="Eliminar"
        className={cn(btn, "hover:text-tv-red")}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
