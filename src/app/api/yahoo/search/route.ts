import type { NextRequest } from "next/server";
import { yahooSearch } from "@/lib/market/server/yahoo";
import { respond } from "@/lib/market/server/route";

export function GET(req: NextRequest) {
  return respond(async () => yahooSearch(req.nextUrl.searchParams.get("q") ?? ""));
}
