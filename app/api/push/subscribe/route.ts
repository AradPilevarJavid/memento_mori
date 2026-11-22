import { NextResponse } from "next/server";

import { scheduleInitialDelivery } from "@/lib/server/delivery-service";
import { isValidSubscription, saveSubscription } from "@/lib/server/subscriptions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isValidSubscription(payload)) {
    return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  }

  try {
    const stored = await saveSubscription(payload);
    await scheduleInitialDelivery(stored).catch(() => undefined);
    return NextResponse.json({ ok: true, endpoint: stored.endpoint });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save the subscription." },
      { status: 500 },
    );
  }
}
