import type { Candle, Ticker24h, Timeframe } from "@/lib/binance/types";
import type { FoundSymbol } from "../provider";

const DATA = "https://data.alpaca.markets/v2/stocks";
// Paper keys only work against the paper trading host; set ALPACA_TRADING_URL for a live account
const TRADING = process.env.ALPACA_TRADING_URL ?? "https://paper-api.alpaca.markets";

/** Thrown when the keys are not configured, so the route can answer 503 */
export class AlpacaConfigError extends Error {}

function headers(): Record<string, string> {
  const id = process.env.ALPACA_KEY_ID;
  const secret = process.env.ALPACA_SECRET_KEY;
  if (!id || !secret) {
    throw new AlpacaConfigError(
      "Faltan ALPACA_KEY_ID y ALPACA_SECRET_KEY en .env.local (reinicia el servidor después de agregarlas)",
    );
  }
  return { "APCA-API-KEY-ID": id, "APCA-API-SECRET-KEY": secret };
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Alpaca ${res.status}${text ? `: ${text.slice(0, 120)}` : ""}`);
  }
  return (await res.json()) as T;
}

const DAY = 86_400_000;

/** Alpaca timeframe and how far back to start so `limit` bars fit */
const FRAMES: Partial<Record<Timeframe, { tf: string; lookbackMs: number }>> = {
  "1m": { tf: "1Min", lookbackMs: 10 * DAY },
  "5m": { tf: "5Min", lookbackMs: 30 * DAY },
  "15m": { tf: "15Min", lookbackMs: 90 * DAY },
  "30m": { tf: "30Min", lookbackMs: 180 * DAY },
  "1h": { tf: "1Hour", lookbackMs: 400 * DAY },
  "4h": { tf: "4Hour", lookbackMs: 3 * 365 * DAY },
  "1d": { tf: "1Day", lookbackMs: 6 * 365 * DAY },
  "1w": { tf: "1Week", lookbackMs: 20 * 365 * DAY },
  "1M": { tf: "1Month", lookbackMs: 40 * 365 * DAY },
};

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export async function alpacaKlines(symbol: string, tf: Timeframe, limit: number): Promise<Candle[]> {
  const frame = FRAMES[tf];
  if (!frame) throw new Error(`Alpaca no soporta el timeframe ${tf}`);
  const params = new URLSearchParams({
    timeframe: frame.tf,
    start: new Date(Date.now() - frame.lookbackMs).toISOString(),
    limit: String(limit),
    // Newest first so `limit` keeps the latest bars; reversed below
    sort: "desc",
    feed: "iex",
    adjustment: "raw",
  });
  const data = await get<{ bars: AlpacaBar[] | null }>(
    `${DATA}/${encodeURIComponent(symbol)}/bars?${params}`,
  );
  return (data.bars ?? [])
    .map((b) => ({
      time: Math.floor(Date.parse(b.t) / 1000),
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
      volume: b.v,
      isFinal: true,
    }))
    .reverse();
}

interface Snapshot {
  latestTrade?: { p: number };
  dailyBar?: { o: number; h: number; l: number; c: number; v: number };
  prevDailyBar?: { c: number };
}

export async function alpacaTickers(symbols: string[]): Promise<Ticker24h[]> {
  const params = new URLSearchParams({ symbols: symbols.join(","), feed: "iex" });
  const snaps = await get<Record<string, Snapshot>>(`${DATA}/snapshots?${params}`);
  return Object.entries(snaps).map(([symbol, s]) => {
    const day = s.dailyBar;
    const last = s.latestTrade?.p ?? day?.c ?? 0;
    const prev = s.prevDailyBar?.c ?? day?.o ?? last;
    const volume = day?.v ?? 0;
    return {
      symbol,
      lastPrice: last,
      priceChange: last - prev,
      priceChangePercent: prev === 0 ? 0 : ((last - prev) / prev) * 100,
      highPrice: day?.h ?? last,
      lowPrice: day?.l ?? last,
      volume,
      quoteVolume: volume * last,
    };
  });
}

interface Asset {
  symbol: string;
  name: string;
  tradable: boolean;
}

let assetCache: { at: number; list: Asset[] } | null = null;

async function assets(): Promise<Asset[]> {
  if (assetCache && Date.now() - assetCache.at < 6 * 3600_000) return assetCache.list;
  const list = await get<Asset[]>(`${TRADING}/v2/assets?status=active&asset_class=us_equity`);
  assetCache = { at: Date.now(), list: list.filter((a) => a.tradable) };
  return assetCache.list;
}

export async function alpacaSearch(q: string): Promise<FoundSymbol[]> {
  const needle = q.trim().toUpperCase();
  const list = await assets();
  // Ticker matches first (exact, then prefix), then company names
  const rank = (a: Asset) =>
    a.symbol === needle ? 0 : a.symbol.startsWith(needle) ? 1 : a.name.toUpperCase().includes(needle) ? 2 : 3;
  return list
    .filter((a) => rank(a) < 3)
    .sort((a, b) => rank(a) - rank(b) || a.symbol.localeCompare(b.symbol))
    .slice(0, 50)
    .map((a) => ({ ticker: a.symbol, base: a.symbol, detail: a.name }));
}
