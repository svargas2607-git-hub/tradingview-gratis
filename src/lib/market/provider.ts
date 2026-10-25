import type { Candle, Ticker24h, Timeframe } from "@/lib/binance/types";

export interface TickUpdate {
  /** Ticker as the provider knows it (no source prefix) */
  symbol: string;
  close: number;
  open: number;
  pct: number;
}

export interface FoundSymbol {
  /** Ticker as the provider knows it (no source prefix) */
  ticker: string;
  base: string;
  /** Quote asset for crypto, company name for stocks */
  detail: string;
}

/** One market data source. All symbols here are raw tickers, without the source prefix. */
export interface MarketProvider {
  fetchKlines(ticker: string, interval: Timeframe, limit?: number): Promise<Candle[]>;
  fetchTicker24h(ticker: string): Promise<Ticker24h>;
  fetchTickers24h(tickers: string[]): Promise<Ticker24h[]>;
  /** Live candle updates; returns the unsubscribe function */
  subscribeKline(
    ticker: string,
    interval: Timeframe,
    onCandle: (c: Candle) => void,
  ): () => void;
  /** Live price updates for the watchlist; returns the unsubscribe function */
  subscribeTickers(tickers: string[], onTick: (t: TickUpdate) => void): () => void;
  search(query: string): Promise<FoundSymbol[]>;
}
