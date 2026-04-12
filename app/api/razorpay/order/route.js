import { NextResponse } from "next/server";
import { POST as createSubscription } from "@/app/api/subscription/create/route";

export async function POST(request) {
  try {
    const response = await createSubscription(request);
    const payload = await response.json();

    if (!response.ok || !payload?.success) {
      return NextResponse.json(
        {
          error:
            payload?.message ||
            payload?.error ||
            "Unable to start subscription.",
        },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json(
      {
        subscription_id: payload?.data?.subscriptionId || null,
        url: payload?.data?.url || null,
      },
      { status: response.status }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start subscription.",
      },
      { status: 500 }
    );
  }
}
