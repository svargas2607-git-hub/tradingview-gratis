import type { NextRequest } from "next/server";
import type { Timeframe } from "@/lib/binance/types";
import { AlpacaConfigError } from "./alpaca";

// "/" is for Alpaca crypto pairs like BTC/USD
const TICKER = /^[A-Za-z0-9.\-/]{1,15}$/;
const TIMEFRAMES = new Set<string>([
  "1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M",
]);

export class BadRequest extends Error {}

export function tickerParam(req: NextRequest, name = "symbol"): string {
  const v = req.nextUrl.searchParams.get(name)?.trim().toUpperCase() ?? "";
  if (!TICKER.test(v)) throw new BadRequest(`${name} inválido`);
  return v;
}

export function tickersParam(req: NextRequest): string[] {
  const list = (req.nextUrl.searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (list.length === 0 || list.length > 50 || !list.every((s) => TICKER.test(s))) {
    throw new BadRequest("symbols inválido");
  }
  return list;
}

export function intervalParam(req: NextRequest): Timeframe {
  const v = req.nextUrl.searchParams.get("interval") ?? "";
  if (!TIMEFRAMES.has(v)) throw new BadRequest("interval inválido");
  return v as Timeframe;
}

export function limitParam(req: NextRequest): number {
  const n = Number(req.nextUrl.searchParams.get("limit") ?? 1000);
  return Number.isFinite(n) ? Math.min(1000, Math.max(1, Math.floor(n))) : 1000;
}

/** Runs the handler and maps failures to JSON errors the UI can show */
export async function respond(fn: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await fn());
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    const status = e instanceof BadRequest ? 400 : e instanceof AlpacaConfigError ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
