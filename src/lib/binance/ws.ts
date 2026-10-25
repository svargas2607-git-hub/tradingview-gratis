import type { Candle, Timeframe } from "./types";

const WS_BASE = "wss://stream.binance.com:9443/stream";

interface KlineMsg {
  stream: string;
  data: {
    e: string;
    E: number;
    s: string;
    k: {
      t: number; // open time
      T: number; // close time
      s: string;
      i: string;
      o: string;
      c: string;
      h: string;
      l: string;
      v: string;
      x: boolean; // is closed
    };
  };
}

interface MiniTickerMsg {
  stream: string;
  data: {
    e: string;
    E: number;
    s: string;
    c: string; // close
    o: string; // open
    h: string;
    l: string;
    v: string;
    q: string;
  };
}

type WSMsg = KlineMsg | MiniTickerMsg;

export interface KlineSubscription {
  symbol: string;
  interval: Timeframe;
  onCandle: (c: Candle) => void;
}

export interface TickerSubscription {
  symbols: string[];
  onTick: (s: { symbol: string; close: number; open: number; pct: number }) => void;
}

/**
 * Single multiplexed WS connection to Binance, with auto-reconnect.
 * Subscriptions can be added/removed at runtime via SUBSCRIBE/UNSUBSCRIBE.
 */
export class BinanceWS {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private nextId = 1;
  // Several charts can watch the same stream: one WS subscription, many listeners
  private klineSubs = new Map<string, Set<KlineSubscription>>();
  private tickerSubs = new Map<string, (m: MiniTickerMsg["data"]) => void>();
  private connected = false;
  private closing = false;

  connect() {
    if (this.ws || this.closing) return;
    this.ws = new WebSocket(WS_BASE);

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      // Re-subscribe everything
      const streams: string[] = [];
      this.klineSubs.forEach((_subs, stream) => streams.push(stream));
      this.tickerSubs.forEach((_v, k) => streams.push(k));
      if (streams.length > 0) this.send({ method: "SUBSCRIBE", params: streams, id: this.nextId++ });
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as WSMsg | { result: unknown; id: number };
        if ("stream" in msg) this.dispatch(msg);
      } catch {
        // ignore
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.ws = null;
      if (!this.closing) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(30000, 1000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(payload: object) {
    if (this.ws && this.connected) this.ws.send(JSON.stringify(payload));
  }

  private dispatch(msg: WSMsg) {
    if (msg.stream.includes("@kline_")) {
      const subs = this.klineSubs.get(msg.stream);
      if (!subs) return;
      const k = (msg as KlineMsg).data.k;
      const candle: Candle = {
        time: Math.floor(k.t / 1000),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
        isFinal: k.x,
      };
      subs.forEach((sub) => sub.onCandle(candle));
    } else if (msg.stream.includes("@miniTicker")) {
      const handler = this.tickerSubs.get(msg.stream);
      if (handler) handler((msg as MiniTickerMsg).data);
    }
  }

  subscribeKline(sub: KlineSubscription): () => void {
    const stream = `${sub.symbol.toLowerCase()}@kline_${sub.interval}`;
    let subs = this.klineSubs.get(stream);
    if (!subs) {
      subs = new Set();
      this.klineSubs.set(stream, subs);
      if (this.connected) this.send({ method: "SUBSCRIBE", params: [stream], id: this.nextId++ });
    }
    subs.add(sub);
    return () => {
      const current = this.klineSubs.get(stream);
      if (!current) return;
      current.delete(sub);
      if (current.size > 0) return;
      this.klineSubs.delete(stream);
      if (this.connected) this.send({ method: "UNSUBSCRIBE", params: [stream], id: this.nextId++ });
    };
  }

  subscribeMiniTickers(
    symbols: string[],
    onTick: (s: { symbol: string; close: number; open: number; pct: number }) => void,
  ): () => void {
    const streams = symbols.map((s) => `${s.toLowerCase()}@miniTicker`);
    streams.forEach((stream) => {
      this.tickerSubs.set(stream, (d) => {
        const close = parseFloat(d.c);
        const open = parseFloat(d.o);
        onTick({
          symbol: d.s,
          close,
          open,
          pct: open === 0 ? 0 : ((close - open) / open) * 100,
        });
      });
    });
    if (this.connected) this.send({ method: "SUBSCRIBE", params: streams, id: this.nextId++ });
    return () => {
      streams.forEach((s) => this.tickerSubs.delete(s));
      if (this.connected) this.send({ method: "UNSUBSCRIBE", params: streams, id: this.nextId++ });
    };
  }

  close() {
    this.closing = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}

// Singleton — only one WS connection per browser tab
let singleton: BinanceWS | null = null;
export function getBinanceWS(): BinanceWS {
  if (typeof window === "undefined") {
    // SSR safety: dummy
    return new BinanceWS();
  }
  if (!singleton) {
    singleton = new BinanceWS();
    singleton.connect();
  }
  return singleton;
}
