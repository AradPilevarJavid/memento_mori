import { NextResponse } from "next/server";
import { sendNotification } from "web-push";

import { ENTRIES, getEntry, selectEntry } from "@/lib/content";
import { notificationPayload } from "@/lib/notifications";
import { removeJob } from "@/lib/server/queue";
import { listSubscriptions, removeSubscription } from "@/lib/server/subscriptions";
import { configureWebPush, vapidConfigured } from "@/lib/server/vapid";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = process.env.PUSH_SEND_TOKEN;
  if (token) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${token}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "PUSH_SEND_TOKEN must be configured before sending notifications in production." },
      { status: 403 },
    );
  }

  if (!vapidConfigured()) {
    return NextResponse.json(
      { error: "VAPID keys are not configured. Run `npm run setup:vapid`." },
      { status: 500 },
    );
  }

  configureWebPush();

  const subscriptions = await listSubscriptions();
  if (subscriptions.length === 0) {
    return NextResponse.json(
      { error: "No push subscriptions have been registered yet." },
      { status: 409 },
    );
  }

  let requestedEntryId: string | undefined;
  try {
    const body = (await request.json()) as { entryId?: unknown };
    if (typeof body.entryId === "string") {
      requestedEntryId = body.entryId;
    }
  } catch {
    requestedEntryId = undefined;
  }

  const entry = requestedEntryId ? getEntry(requestedEntryId) : selectEntry([], ENTRIES);
  if (!entry) {
    return NextResponse.json({ error: "Unknown content entry." }, { status: 404 });
  }

  const payload = JSON.stringify(notificationPayload(entry));
  const results = await Promise.allSettled(
    subscriptions.map((subscription) => sendNotification(subscription, payload)),
  );

  let sent = 0;
  let failed = 0;

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      sent += 1;
      return;
    }

    failed += 1;
    const statusCode = (result.reason as { statusCode?: number } | undefined)?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      void removeSubscription(subscriptions[index].endpoint);
      void removeJob(subscriptions[index].endpoint);
    }
  });

  return NextResponse.json({
    ok: sent > 0,
    sent,
    failed,
    entryId: entry.id,
  });
}
