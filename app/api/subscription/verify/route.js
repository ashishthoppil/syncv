import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Verification endpoint is deprecated. Use webhook-driven activation." },
    { status: 410 }
  );
}
