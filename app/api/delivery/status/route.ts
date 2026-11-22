import { NextResponse } from "next/server";

import { getDeliveryStatus } from "@/lib/server/delivery-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json(
      { error: "An endpoint is required." },
      { status: 400 },
    );
  }

  const status = await getDeliveryStatus(endpoint);
  if (!status) {
    return NextResponse.json(
      { error: "Push subscription not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(status);
}
