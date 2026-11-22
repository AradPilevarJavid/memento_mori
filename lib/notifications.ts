import { attributionLines, CATEGORY_META, type Entry } from "@/lib/content";

export interface NotificationPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export type NotificationSupport = "unsupported" | "default" | "granted" | "denied";

export function notificationSupport(): NotificationSupport {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationSupport> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

export function notificationPayload(entry: Entry): NotificationPayload {
  return {
    title: `MEMENTO MORI · ${CATEGORY_META[entry.category].label}`,
    body: `${entry.text}\n\n${attributionLines(entry).join("\n")}`,
    url: "/",
    tag: "memento",
  };
}

export async function showEntryNotification(entry: Entry): Promise<"shown" | "denied" | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission !== "granted") {
    return "denied";
  }

  const payload = notificationPayload(entry);

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(payload.title, {
          body: payload.body,
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag: payload.tag,
          data: { url: payload.url },
        });
        return "shown";
      }
    } catch {
      // Fall through to the page-level Notification API.
    }
  }

  new Notification(payload.title, {
    body: payload.body,
    icon: "/icons/icon-192.png",
  });
  return "shown";
}
