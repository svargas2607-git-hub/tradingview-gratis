import type { NextRequest } from "next/server";
import { yahooKlines } from "@/lib/market/server/yahoo";
import { intervalParam, limitParam, respond, tickerParam } from "@/lib/market/server/route";

export function GET(req: NextRequest) {
  return respond(async () => yahooKlines(tickerParam(req), intervalParam(req), limitParam(req)));
}
