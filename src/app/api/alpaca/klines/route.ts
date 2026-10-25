import type { NextRequest } from "next/server";
import { alpacaKlines } from "@/lib/market/server/alpaca";
import { intervalParam, limitParam, respond, tickerParam } from "@/lib/market/server/route";

export function GET(req: NextRequest) {
  return respond(async () => alpacaKlines(tickerParam(req), intervalParam(req), limitParam(req)));
}
