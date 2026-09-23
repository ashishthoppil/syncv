import { NextResponse } from "next/server";
import { getPricingRegionForRequest } from "@/lib/server/pricing-region";

// Region depends on who is asking, so it must never be cached and shared.
export const dynamic = "force-dynamic";

export async function GET(request) {
  return NextResponse.json(
    { region: getPricingRegionForRequest(request) },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
