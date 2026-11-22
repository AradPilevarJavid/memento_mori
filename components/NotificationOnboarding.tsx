"use client";

import { useEffect, useState } from "react";

import {
  notificationSupport,
  requestNotificationPermission,
  type NotificationSupport,
} from "@/lib/notifications";
import {
  getPushSubscription,
  pushSupported,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import { addHistory } from "@/lib/storage";

type PushState = "checking" | "off" | "on" | "unsupported";

export function NotificationOnboarding() {
  const [permission, setPermission] = useState<NotificationSupport>("unsupported");
  const [pushState, setPushState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setPermission(notificationSupport());
    if (!pushSupported()) {
      setPushState("unsupported");
      return;
    }
    void getPushSubscription().then((subscription) => {
      setPushState(subscription ? "on" : "off");
    });
  }, []);

  const enable = async () => {
    setBusy(true);
    setMessage(null);

    const result = await requestNotificationPermission();
    setPermission(result);

    if (result !== "granted") {
      setMessage(
        result === "denied"
          ? "Notifications are blocked. Allow them in your browser's site settings, then try again."
          : "Notification permission was not granted.",
      );
      setBusy(false);
      return;
    }

    const subscription = await subscribeToPush();
    if (subscription.status === "subscribed") {
      setPushState("on");
      setMessage("Push notifications are enabled on this device.");
      window.dispatchEvent(new Event("memento:push"));
    } else {
      setPushState(subscription.status === "unconfigured" ? "unsupported" : "off");
      setMessage(subscription.message);
    }
    setBusy(false);
  };

  const disable = async () => {
    setBusy(true);
    setMessage(null);
    const result = await unsubscribeFromPush();
    setPushState(result.ok ? "off" : "on");
    setMessage(result.ok ? "Push notifications are disabled." : result.message ?? "Could not disable push.");
    if (result.ok) {
      window.dispatchEvent(new Event("memento:push"));
    }
    setBusy(false);
  };

  const sendTest = async () => {
    setBusy(true);
    setMessage(null);
    const result = await sendTestPush();
    if (result.ok && result.entryId) {
      addHistory(result.entryId, "push");
    }
    setMessage(result.message);
    setBusy(false);
  };

  const statusLabel =
    pushState === "on"
      ? "Push enabled"
      : pushState === "checking"
        ? "Checking"
        : pushState === "unsupported"
          ? "Unavailable"
          : "Not enabled";

  return (
    <section className="panel onboarding-panel" aria-labelledby="notifications-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Interruptions</p>
          <h2 id="notifications-heading">Notifications</h2>
        </div>
        <span className={pushState === "on" ? "status status-on" : "status"}>{statusLabel}</span>
      </div>

      <p className="panel-copy">
        MEMENTO asks for notification permission only when you choose. Nothing is sent until you
        enable it.
      </p>

      <dl className="status-list">
        <div>
          <dt>Browser permission</dt>
          <dd>{permission === "granted" ? "Allowed" : permission === "denied" ? "Blocked" : "Not requested"}</dd>
        </div>
        <div>
          <dt>Push subscription</dt>
          <dd>{pushState === "on" ? "Active on this device" : pushState === "unsupported" ? "Not supported" : "Inactive"}</dd>
        </div>
      </dl>

      {message ? <p className="notice">{message}</p> : null}

      <div className="button-row">
        {pushState === "on" ? (
          <button type="button" className="button button-ghost" onClick={disable} disabled={busy}>
            {busy ? "Working..." : "Disable push"}
          </button>
        ) : (
          <button
            type="button"
            className="button"
            onClick={enable}
            disabled={busy || pushState === "unsupported"}
          >
            {busy ? "Working..." : "Enable notifications"}
          </button>
        )}

        {pushState === "on" ? (
          <button type="button" className="button button-ghost" onClick={sendTest} disabled={busy}>
            Send test notification
          </button>
        ) : null}
      </div>
    </section>
  );
}
