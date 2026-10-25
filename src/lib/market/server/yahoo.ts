import type { Candle, Ticker24h, Timeframe } from "@/lib/binance/types";
import type { FoundSymbol } from "../provider";

const CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const SEARCH = "https://query2.finance.yahoo.com/v1/finance/search";

// Yahoo rejects requests without a browser-like user agent
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; tradingview-gratis)" };

interface YahooRange {
  interval: string;
  /** Enough history to fill the chart */
  full: string;
  /** Just the latest bars, for live polling */
  recent: string;
  /** Hourly bars grouped into 4h ones (Yahoo has no 4h) */
  groupBars?: number;
}

const RANGES: Partial<Record<Timeframe, YahooRange>> = {
  "1m": { interval: "1m", full: "7d", recent: "1d" },
  "5m": { interval: "5m", full: "60d", recent: "5d" },
  "15m": { interval: "15m", full: "60d", recent: "5d" },
  "30m": { interval: "30m", full: "60d", recent: "5d" },
  "1h": { interval: "60m", full: "2y", recent: "5d" },
  "4h": { interval: "60m", full: "2y", recent: "5d", groupBars: 4 },
  "1d": { interval: "1d", full: "5y", recent: "1mo" },
  "1w": { interval: "1wk", full: "10y", recent: "6mo" },
  "1M": { interval: "1mo", full: "max", recent: "2y" },
};

interface ChartResult {
  meta: {
    instrumentType?: string;
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    previousClose?: number;
    regularMarketDayHigh?: number;
    regularMarketDayLow?: number;
    regularMarketVolume?: number;
  };
  timestamp?: number[];
  indicators: {
    quote: {
      open: (number | null)[];
      high: (number | null)[];
      low: (number | null)[];
      close: (number | null)[];
      volume: (number | null)[];
    }[];
  };
}

async function chart(symbol: string, interval: string, range: string): Promise<ChartResult> {
  const url = `${CHART}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`Yahoo ${res.status} para ${symbol}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0] as ChartResult | undefined;
  if (!result) throw new Error(json?.chart?.error?.description ?? `Yahoo sin datos para ${symbol}`);
  return result;
}

/** Seconds per bar for minute intervals; their open bar can carry a live timestamp off the grid */
const MINUTE_STEPS: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900, "30m": 1800 };

function toCandles(r: ChartResult, interval: string): Candle[] {
  const q = r.indicators.quote[0];
  const out: Candle[] = [];
  const step = MINUTE_STEPS[interval];
  (r.timestamp ?? []).forEach((ts, i) => {
    const t = step ? Math.floor(ts / step) * step : ts;
    const open = q.open[i];
    const high = q.high[i];
    const low = q.low[i];
    const close = q.close[i];
    // Yahoo leaves nulls for bars with no trades
    if (open == null || high == null || low == null || close == null) return;
    // Two bars on the same slot: keep the newer one
    if (out.length > 0 && out[out.length - 1].time === t) out.pop();
    out.push({ time: t, open, high, low, close, volume: q.volume[i] ?? 0, isFinal: true });
  });
  return out;
}

/** Crypto never closes: group hourly bars into clock-aligned buckets (00, 04, 08 UTC…) */
function groupAligned(bars: Candle[], size: number): Candle[] {
  const out: Candle[] = [];
  for (const b of bars) {
    const bucket = Math.floor(b.time / (size * 3600)) * size * 3600;
    const g = out[out.length - 1];
    if (g && g.time === bucket) {
      g.high = Math.max(g.high, b.high);
      g.low = Math.min(g.low, b.low);
      g.close = b.close;
      g.volume += b.volume;
    } else {
      out.push({ ...b, time: bucket });
    }
  }
  return out;
}

/** Groups consecutive bars of the same session, e.g. 7 hourly bars → 4 + 3 */
function groupBars(bars: Candle[], size: number): Candle[] {
  const out: Candle[] = [];
  let count = 0;
  let prevTime = 0;
  for (const b of bars) {
    // A gap over `size` hours means a new session
    if (count === 0 || b.time - prevTime > size * 3600 || count >= size) {
      out.push({ ...b });
      count = 1;
    } else {
      const g = out[out.length - 1];
      g.high = Math.max(g.high, b.high);
      g.low = Math.min(g.low, b.low);
      g.close = b.close;
      g.volume += b.volume;
      count++;
    }
    prevTime = b.time;
  }
  return out;
}

export async function yahooKlines(symbol: string, tf: Timeframe, limit: number): Promise<Candle[]> {
  const cfg = RANGES[tf];
  if (!cfg) throw new Error(`Yahoo no soporta el timeframe ${tf}`);
  const r = await chart(symbol, cfg.interval, limit <= 5 ? cfg.recent : cfg.full);
  let bars = toCandles(r, cfg.interval);
  if (cfg.groupBars) {
    bars =
      r.meta.instrumentType === "CRYPTOCURRENCY"
        ? groupAligned(bars, cfg.groupBars)
        : groupBars(bars, cfg.groupBars);
  }
  return bars.slice(-limit);
}

export async function yahooTicker(symbol: string): Promise<Ticker24h> {
  const r = await chart(symbol, "1d", "5d");
  const m = r.meta;
  const last = m.regularMarketPrice ?? 0;
  const prev = m.chartPreviousClose ?? m.previousClose ?? last;
  const volume = m.regularMarketVolume ?? 0;
  return {
    symbol,
    lastPrice: last,
    priceChange: last - prev,
    priceChangePercent: prev === 0 ? 0 : ((last - prev) / prev) * 100,
    highPrice: m.regularMarketDayHigh ?? last,
    lowPrice: m.regularMarketDayLow ?? last,
    volume,
    quoteVolume: volume * last,
  };
}

export async function yahooSearch(q: string): Promise<FoundSymbol[]> {
  const url = `${SEARCH}?q=${encodeURIComponent(q)}&quotesCount=20&newsCount=0`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`Yahoo search ${res.status}`);
  const json = await res.json();
  return (json.quotes ?? [])
    .filter(
      (x: { quoteType?: string; symbol?: string }) =>
        (x.quoteType === "EQUITY" || x.quoteType === "ETF" || x.quoteType === "CRYPTOCURRENCY") &&
        x.symbol &&
        !x.symbol.includes("."),
    )
    .map((x: { symbol: string; shortname?: string; longname?: string }) => ({
      ticker: x.symbol,
      base: x.symbol,
      detail: x.shortname ?? x.longname ?? "",
    }));
}
