export type MarketSource = "binance" | "alpaca" | "yahoo";

export const SOURCES: { id: MarketSource; label: string; hint: string }[] = [
  { id: "binance", label: "Cripto · Binance", hint: "BTC, ETH, SOL…" },
  { id: "alpaca", label: "Acciones EE.UU. · Alpaca", hint: "AAPL, TSLA, SPY…" },
  { id: "yahoo", label: "Acciones EE.UU. · Yahoo", hint: "AAPL, TSLA, SPY…" },
];

/**
 * App symbols keep Binance pairs as they were ("BTCUSDT") so saved charts,
 * drawings and watchlists still work; other sources carry a prefix
 * ("alpaca:AAPL", "yahoo:AAPL").
 */
export function parseSymbol(symbol: string): { source: MarketSource; ticker: string } {
  const i = symbol.indexOf(":");
  if (i > 0) {
    const prefix = symbol.slice(0, i);
    if (prefix === "alpaca" || prefix === "yahoo") {
      return { source: prefix, ticker: symbol.slice(i + 1) };
    }
  }
  return { source: "binance", ticker: symbol };
}

export function appSymbol(source: MarketSource, ticker: string): string {
  return source === "binance" ? ticker : `${source}:${ticker}`;
}

/** Name shown in the UI: base asset and quote/market */
export function symbolLabel(symbol: string): { base: string; quote: string; source: MarketSource } {
  const { source, ticker } = parseSymbol(symbol);
  if (source === "binance") {
    return ticker.endsWith("USDT")
      ? { base: ticker.slice(0, -4), quote: "USDT", source }
      : { base: ticker, quote: "", source };
  }
  return { base: ticker, quote: source === "alpaca" ? "ALPACA" : "YAHOO", source };
}
