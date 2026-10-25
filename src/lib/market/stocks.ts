import type { Candle, Ticker24h, Timeframe } from "@/lib/binance/types";
import type { FoundSymbol, MarketProvider } from "./provider";

/**
 * US stocks over our own route handlers (/api/alpaca, /api/yahoo): keys stay on
 * the server and the browser never hits CORS. Neither source pushes candles, so
 * "live" is polling the last bars.
 */
export function createStockProvider(
  basePath: string,
  pollKlineMs: number,
  pollTickerMs: number,
): MarketProvider {
  async function getJson<T>(path: string, params: Record<string, string>): Promise<T> {
    const res = await fetch(`${basePath}/${path}?${new URLSearchParams(params)}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `${basePath}/${path} ${res.status}`);
    }
    return (await res.json()) as T;
  }

  const fetchKlines = (ticker: string, interval: Timeframe, limit = 1000) =>
    getJson<Candle[]>("klines", { symbol: ticker, interval, limit: String(limit) });

  const fetchTickers24h = (tickers: string[]) =>
    getJson<Ticker24h[]>("tickers", { symbols: tickers.join(",") });

  return {
    fetchKlines,
    fetchTickers24h,
    async fetchTicker24h(ticker) {
      const [t] = await fetchTickers24h([ticker]);
      if (!t) throw new Error(`ticker ${ticker}`);
      return t;
    },
    subscribeKline(ticker, interval, onCandle) {
      let stopped = false;
      const poll = () => {
        // The last two bars: the open one and the one that may have just closed
        fetchKlines(ticker, interval, 2)
          .then((bars) => {
            if (!stopped) bars.forEach(onCandle);
          })
          .catch(() => {});
      };
      const id = setInterval(poll, pollKlineMs);
      return () => {
        stopped = true;
        clearInterval(id);
      };
    },
    subscribeTickers(tickers, onTick) {
      let stopped = false;
      const poll = () => {
        fetchTickers24h(tickers)
          .then((list) => {
            if (stopped) return;
            list.forEach((t) =>
              onTick({
                symbol: t.symbol,
                close: t.lastPrice,
                open: t.lastPrice - t.priceChange,
                pct: t.priceChangePercent,
              }),
            );
          })
          .catch(() => {});
      };
      const id = setInterval(poll, pollTickerMs);
      return () => {
        stopped = true;
        clearInterval(id);
      };
    },
    async search(query) {
      const q = query.trim();
      if (!q) return [];
      return getJson<FoundSymbol[]>("search", { q });
    },
  };
}
