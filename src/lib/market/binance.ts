import {
  fetchExchangeSymbols,
  fetchKlines,
  fetchTicker24h,
  fetchTickers24h,
} from "@/lib/binance/rest";
import { getBinanceWS } from "@/lib/binance/ws";
import type { MarketProvider } from "./provider";

export const binanceProvider: MarketProvider = {
  fetchKlines,
  fetchTicker24h,
  fetchTickers24h,
  subscribeKline: (ticker, interval, onCandle) =>
    getBinanceWS().subscribeKline({ symbol: ticker, interval, onCandle }),
  subscribeTickers: (tickers, onTick) => getBinanceWS().subscribeMiniTickers(tickers, onTick),
  async search(query) {
    const all = await fetchExchangeSymbols();
    const q = query.trim().toUpperCase();
    const found = q
      ? all.filter(
          (s) => s.symbol.includes(q) || s.baseAsset.includes(q) || s.quoteAsset.includes(q),
        )
      : all;
    return found
      .slice(0, 100)
      .map((s) => ({ ticker: s.symbol, base: s.baseAsset, detail: `/ ${s.quoteAsset}` }));
  },
};
