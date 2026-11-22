import { NextResponse } from "next/server";

import { setDeliveryPaused } from "@/lib/server/delivery-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { error: "A request body is required." },
      { status: 400 },
    );
  }

  const body = payload as { endpoint?: unknown; paused?: unknown };
  if (typeof body.endpoint !== "string" || body.endpoint.length === 0) {
    return NextResponse.json(
      { error: "An endpoint is required." },
      { status: 400 },
    );
  }
  if (typeof body.paused !== "boolean") {
    return NextResponse.json(
      { error: "paused must be a boolean." },
      { status: 400 },
    );
  }

  const status = await setDeliveryPaused(body.endpoint, body.paused);
  if (!status) {
    return NextResponse.json(
      { error: "Push subscription not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(status);
}
