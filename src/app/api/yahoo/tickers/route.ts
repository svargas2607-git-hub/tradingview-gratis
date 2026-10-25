import type { NextRequest } from "next/server";
import { yahooTicker } from "@/lib/market/server/yahoo";
import { respond, tickersParam } from "@/lib/market/server/route";

export function GET(req: NextRequest) {
  // Yahoo's batch quote endpoint needs a login crumb, so one chart request per symbol
  return respond(async () => Promise.all(tickersParam(req).map(yahooTicker)));
}
