"use client";

import { useEffect, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { appSymbol, searchSymbols, SOURCES, symbolLabel, type MarketSource } from "@/lib/market";
import type { FoundSymbol } from "@/lib/market/provider";
import { useChartStore } from "@/lib/store/chart-store";
import { cn } from "@/lib/utils";

export function SymbolSelector() {
  const symbol = useChartStore((s) => s.symbol);
  const setSymbol = useChartStore((s) => s.setSymbol);
  const addToWatchlist = useChartStore((s) => s.addToWatchlist);
  const open = useChartStore((s) => s.symbolDialogOpen);
  const setOpen = useChartStore((s) => s.setSymbolDialogOpen);

  const [query, setQuery] = useState("");
  const [source, setSource] = useState<MarketSource>(() => symbolLabel(symbol).source);
  const [results, setResults] = useState<FoundSymbol[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Debounced: stock sources search on the server, one request per pause in typing
    const id = setTimeout(
      () => {
        setLoading(true);
        setError(null);
        searchSymbols(source, query)
          .then((found) => {
            if (!cancelled) setResults(found);
          })
          .catch((e: Error) => {
            if (cancelled) return;
            setResults([]);
            setError(e.message);
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      },
      source === "binance" ? 0 : 250,
    );
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [open, source, query]);

  const hint = SOURCES.find((s) => s.id === source)?.hint;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="group flex items-center gap-2 rounded px-3 py-1.5 text-sm font-semibold hover:bg-tv-panel-hover">
        <Search className="h-3.5 w-3.5 text-tv-text-muted group-hover:text-tv-text" />
        <span className="tabular-nums">{displayName(symbol)}</span>
        <ChevronDown className="h-3.5 w-3.5 text-tv-text-muted" />
      </DialogTrigger>
      <DialogContent className="max-w-md grid-cols-[minmax(0,1fr)] gap-0 overflow-hidden bg-tv-panel p-0">
        <DialogHeader className="border-b border-tv-border px-4 py-3">
          <DialogTitle className="text-sm font-medium">Buscar símbolo</DialogTitle>
        </DialogHeader>
        <div className="flex gap-1 border-b border-tv-border p-2">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              title={s.label}
              onClick={() => {
                setSource(s.id);
                setResults([]);
              }}
              className={cn(
                "flex-1 rounded px-2 py-1.5 text-[11px] font-medium transition-colors",
                source === s.id
                  ? "bg-tv-panel-hover text-tv-text"
                  : "text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text",
              )}
            >
              {s.short}
            </button>
          ))}
        </div>
        <div className="border-b border-tv-border p-3">
          <Input
            autoFocus
            placeholder={hint}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-tv-bg"
          />
        </div>
        <ScrollArea className="h-[400px]">
          <div className="flex w-full min-w-0 flex-col">
            {error && <div className="p-4 text-center text-xs text-tv-red">{error}</div>}
            {!error && !loading && results.length === 0 && (
              <div className="p-4 text-center text-xs text-tv-text-muted">
                {source !== "binance" && !query.trim() ? "Escribe un ticker" : "Sin resultados"}
              </div>
            )}
            {results.map((s) => {
              const full = appSymbol(source, s.ticker);
              return (
                <button
                  key={full}
                  onClick={() => {
                    setSymbol(full);
                    addToWatchlist(full);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full min-w-0 items-center justify-between gap-3 overflow-hidden border-b border-tv-border px-4 py-2 text-left text-xs hover:bg-tv-panel-hover",
                    full === symbol && "bg-tv-panel-hover",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 font-semibold text-tv-text">{s.base}</span>
                    <span className="truncate text-tv-text-muted">{s.detail}</span>
                  </div>
                  {source === "binance" && (
                    <span className="shrink-0 text-tv-text-muted">{s.ticker}</span>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function displayName(symbol: string): string {
  const { base, quote, source } = symbolLabel(symbol);
  return source === "binance" ? `${base}${quote}` : base;
}
