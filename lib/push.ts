export type PushResult =
  | { status: "subscribed"; endpoint: string }
  | { status: "unsupported" | "denied" | "unconfigured"; message: string }
  | { status: "error"; message: string };

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getVapidPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  return key && key.length > 0 ? key : null;
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration ? await registration.pushManager.getSubscription() : null;
  } catch {
    return null;
  }
}

export async function subscribeToPush(): Promise<PushResult> {
  if (!pushSupported()) {
    return {
      status: "unsupported",
      message: "This browser does not support Web Push notifications.",
    };
  }

  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return {
      status: "unconfigured",
      message: "Push notifications are not configured. Add VAPID keys to the environment.",
    };
  }

  if (Notification.permission !== "granted") {
    return { status: "denied", message: "Notification permission has not been granted." };
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.error ?? "Could not save the push subscription.");
    }

    return { status: "subscribed", endpoint: subscription.endpoint };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not enable push notifications.",
    };
  }
}

export async function unsubscribeFromPush(): Promise<{ ok: boolean; message?: string }> {
  if (!pushSupported()) {
    return { ok: false, message: "This browser does not support Web Push notifications." };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = registration ? await registration.pushManager.getSubscription() : null;
    if (!subscription) {
      return { ok: true };
    }

    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => undefined);

    await subscription.unsubscribe();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not disable push notifications.",
    };
  }
}

export async function sendTestPush(entryId?: string): Promise<{
  ok: boolean;
  message: string;
  entryId?: string;
}> {
  try {
    const response = await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entryId ? { entryId } : {}),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        message: payload?.error ?? "The test notification could not be sent.",
      };
    }

    return {
      ok: true,
      message: `Push sent to ${payload.sent} subscription${payload.sent === 1 ? "" : "s"}.`,
      entryId: payload.entryId,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "The test notification could not be sent.",
    };
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }
  return output;
}
