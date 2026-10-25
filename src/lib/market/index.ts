import type { Candle, Ticker24h, Timeframe } from "@/lib/binance/types";
import { binanceProvider } from "./binance";
import type { FoundSymbol, MarketProvider, TickUpdate } from "./provider";
import { createStockProvider } from "./stocks";
import { appSymbol, parseSymbol, type MarketSource } from "./symbol";

export { SOURCES, symbolLabel, appSymbol, parseSymbol } from "./symbol";
export type { MarketSource } from "./symbol";

const PROVIDERS: Record<MarketSource, MarketProvider> = {
  binance: binanceProvider,
  alpaca: createStockProvider("/api/alpaca", 5_000, 10_000),
  yahoo: createStockProvider("/api/yahoo", 10_000, 15_000),
};

export function getProvider(source: MarketSource): MarketProvider {
  return PROVIDERS[source];
}

export function fetchKlines(symbol: string, interval: Timeframe, limit = 1000): Promise<Candle[]> {
  const { source, ticker } = parseSymbol(symbol);
  return PROVIDERS[source].fetchKlines(ticker, interval, limit);
}

export function subscribeKline(
  symbol: string,
  interval: Timeframe,
  onCandle: (c: Candle) => void,
): () => void {
  const { source, ticker } = parseSymbol(symbol);
  return PROVIDERS[source].subscribeKline(ticker, interval, onCandle);
}

export async function fetchTicker24h(symbol: string): Promise<Ticker24h> {
  const { source, ticker } = parseSymbol(symbol);
  const t = await PROVIDERS[source].fetchTicker24h(ticker);
  return { ...t, symbol };
}

/** Mixed watchlist: one request per source, results keyed by app symbol */
export async function fetchTickers24h(symbols: string[]): Promise<Ticker24h[]> {
  const groups = groupBySource(symbols);
  const results = await Promise.all(
    groups.map(async ([source, tickers]) => {
      try {
        const list = await PROVIDERS[source].fetchTickers24h(tickers);
        return list.map((t) => ({ ...t, symbol: appSymbol(source, t.symbol) }));
      } catch (e) {
        // One source failing (e.g. missing Alpaca keys) must not blank the others
        console.error(`tickers ${source}:`, e);
        return [];
      }
    }),
  );
  return results.flat();
}

export function subscribeTickers(
  symbols: string[],
  onTick: (t: TickUpdate) => void,
): () => void {
  const unsubs = groupBySource(symbols).map(([source, tickers]) =>
    PROVIDERS[source].subscribeTickers(tickers, (t) =>
      onTick({ ...t, symbol: appSymbol(source, t.symbol) }),
    ),
  );
  return () => unsubs.forEach((u) => u());
}

export function searchSymbols(source: MarketSource, query: string): Promise<FoundSymbol[]> {
  return PROVIDERS[source].search(query);
}

function groupBySource(symbols: string[]): [MarketSource, string[]][] {
  const map = new Map<MarketSource, string[]>();
  for (const s of symbols) {
    const { source, ticker } = parseSymbol(s);
    map.set(source, [...(map.get(source) ?? []), ticker]);
  }
  return [...map.entries()];
}
