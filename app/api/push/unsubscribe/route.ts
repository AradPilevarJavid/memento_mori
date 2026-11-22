import { NextResponse } from "next/server";

import { removeJob } from "@/lib/server/queue";
import { removeSubscription } from "@/lib/server/subscriptions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const endpoint =
    payload && typeof payload === "object" && "endpoint" in payload
      ? (payload as { endpoint?: unknown }).endpoint
      : undefined;

  if (typeof endpoint !== "string" || endpoint.length === 0) {
    return NextResponse.json({ error: "An endpoint is required." }, { status: 400 });
  }

  try {
    await removeSubscription(endpoint);
    await removeJob(endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not remove the subscription." },
      { status: 500 },
    );
  }
}
