import { NextResponse } from "next/server";

import {
  normalizeDeliveryPreferences,
  validateDeliveryPreferences,
} from "@/lib/delivery";
import { updateDeliveryPreferences } from "@/lib/server/delivery-service";

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

  const body = payload as { endpoint?: unknown; preferences?: unknown };
  if (typeof body.endpoint !== "string" || body.endpoint.length === 0) {
    return NextResponse.json(
      { error: "An endpoint is required." },
      { status: 400 },
    );
  }

  const validationError = validateDeliveryPreferences(body.preferences);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const preferences = normalizeDeliveryPreferences(body.preferences);
  const status = await updateDeliveryPreferences(body.endpoint, preferences);
  if (!status) {
    return NextResponse.json(
      { error: "Push subscription not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(status);
}
