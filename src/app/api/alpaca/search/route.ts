import type { NextRequest } from "next/server";
import { alpacaSearch } from "@/lib/market/server/alpaca";
import { respond } from "@/lib/market/server/route";

export function GET(req: NextRequest) {
  return respond(async () => alpacaSearch(req.nextUrl.searchParams.get("q") ?? ""));
}
