import type { NextRequest } from "next/server";
import { alpacaTickers } from "@/lib/market/server/alpaca";
import { respond, tickersParam } from "@/lib/market/server/route";

export function GET(req: NextRequest) {
  return respond(async () => alpacaTickers(tickersParam(req)));
}
