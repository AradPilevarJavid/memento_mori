"use client";

import { useEffect, useState, type FormEvent } from "react";

import { NotificationOnboarding } from "@/components/NotificationOnboarding";
import { browserTimezone, normalizeDeliveryPreferences } from "@/lib/delivery";
import {
  fetchDeliveryStatus,
  saveDeliveryPreferences,
  setDeliveryPaused,
  type DeliveryStatus,
} from "@/lib/delivery-api";
import { getPushSubscription } from "@/lib/push";
import {
  DEFAULT_PREFERENCES,
  clearHistory,
  loadHistory,
  loadPreferences,
  savePreferences,
  type Preferences,
} from "@/lib/storage";

function formatMoment(value: string | null | undefined): string {
  if (!value) {
    return "Not yet";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function SettingsView() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [historyCount, setHistoryCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshDelivery = async () => {
    const subscription = await getPushSubscription();
    if (!subscription) {
      setEndpoint(null);
      setDeliveryStatus(null);
      return;
    }

    setEndpoint(subscription.endpoint);
    try {
      setDeliveryStatus(await fetchDeliveryStatus(subscription.endpoint));
    } catch {
      setDeliveryStatus(null);
    }
  };

  useEffect(() => {
    setPreferences(loadPreferences());
    const refreshHistory = () => setHistoryCount(loadHistory().length);
    const refreshPush = () => {
      void refreshDelivery();
    };
    refreshHistory();
    void refreshDelivery();
    window.addEventListener("memento:storage", refreshHistory);
    window.addEventListener("memento:push", refreshPush);
    return () => {
      window.removeEventListener("memento:storage", refreshHistory);
      window.removeEventListener("memento:push", refreshPush);
    };
  }, []);

  const update = <Key extends keyof Preferences>(key: Key, value: Preferences[Key]) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    setMessage(null);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const timezone = browserTimezone();
    const next = normalizeDeliveryPreferences(
      { ...preferences, timezone },
      timezone,
    );
    setPreferences(next);
    savePreferences(next);
    setBusy(true);

    try {
      const subscription = await getPushSubscription();
      if (!subscription) {
        setEndpoint(null);
        setDeliveryStatus(null);
        setMessage(
          "Preferences saved locally. Enable push notifications to schedule server delivery.",
        );
        return;
      }

      setEndpoint(subscription.endpoint);
      const status = await saveDeliveryPreferences(subscription.endpoint, next);
      setDeliveryStatus(status);
      setMessage(
        status.preferences.paused
          ? "Preferences saved. Automatic delivery is paused."
          : "Preferences saved and synced for push delivery.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Preferences saved locally, but server sync failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const togglePause = async () => {
    const paused = !preferences.paused;
    const next = { ...preferences, paused };
    setPreferences(next);
    savePreferences(next);
    setBusy(true);

    try {
      const subscription = await getPushSubscription();
      if (!subscription) {
        setEndpoint(null);
        setDeliveryStatus(null);
        setMessage(
          paused
            ? "Delivery paused locally. Enable push to control server delivery."
            : "Delivery resumed locally.",
        );
        return;
      }

      setEndpoint(subscription.endpoint);
      const status = await setDeliveryPaused(subscription.endpoint, paused);
      setDeliveryStatus(status);
      setMessage(
        paused ? "Automatic delivery paused." : "Automatic delivery resumed.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update the delivery state.",
      );
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    const timezone = browserTimezone();
    const next = normalizeDeliveryPreferences(
      { ...DEFAULT_PREFERENCES, timezone },
      timezone,
    );
    setPreferences(next);
    savePreferences(next);
    setMessage("Preferences reset locally. Save to sync with push delivery.");
  };

  const deliveryLabel = deliveryStatus
    ? deliveryStatus.preferences.paused
      ? "Paused"
      : deliveryStatus.schedulerRunning
        ? "Scheduled"
        : "Scheduler offline"
    : endpoint
      ? "Unavailable"
      : "Local only";
  const deliveryActive = Boolean(
    deliveryStatus &&
      !deliveryStatus.preferences.paused &&
      deliveryStatus.schedulerRunning,
  );

  return (
    <div className="settings-grid">
      <NotificationOnboarding />

      <section className="panel" aria-labelledby="delivery-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Restraint</p>
            <h2 id="delivery-heading">Delivery preferences</h2>
          </div>
        </div>

        <p className="panel-copy">
          These boundaries are stored locally and synced to the scheduler when push delivery is
          enabled. Delivery times vary within the allowed window.
        </p>

        <form className="preferences-form" onSubmit={save}>
          <div className="form-row">
            <label className="field">
              <span>Active hours start</span>
              <input
                type="time"
                value={preferences.activeStart}
                onChange={(event) => update("activeStart", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Active hours end</span>
              <input
                type="time"
                value={preferences.activeEnd}
                onChange={(event) => update("activeEnd", event.target.value)}
              />
            </label>
          </div>

          <div className="form-row">
            <label className="field">
              <span>Quiet hours start</span>
              <input
                type="time"
                value={preferences.quietStart}
                onChange={(event) => update("quietStart", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Quiet hours end</span>
              <input
                type="time"
                value={preferences.quietEnd}
                onChange={(event) => update("quietEnd", event.target.value)}
              />
            </label>
          </div>

          <div className="form-row">
            <label className="field">
              <span>Minimum interval (minutes)</span>
              <input
                type="number"
                min={1}
                value={preferences.minMinutes}
                onChange={(event) => update("minMinutes", Number(event.target.value))}
              />
            </label>
            <label className="field">
              <span>Maximum interval (minutes)</span>
              <input
                type="number"
                min={1}
                value={preferences.maxMinutes}
                onChange={(event) => update("maxMinutes", Number(event.target.value))}
              />
            </label>
          </div>

          <div className="form-row">
            <label className="field">
              <span>Maximum deliveries per day</span>
              <input
                type="number"
                min={1}
                max={24}
                value={preferences.maxPerDay}
                onChange={(event) => update("maxPerDay", Number(event.target.value))}
              />
            </label>
            <label className="field">
              <span>Timezone</span>
              <input type="text" value={preferences.timezone} readOnly />
            </label>
          </div>

          <div className="button-row">
            <button type="submit" className="button" disabled={busy}>
              {busy ? "Saving..." : "Save preferences"}
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={togglePause}
              disabled={busy}
            >
              {preferences.paused ? "Resume delivery" : "Pause delivery"}
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={reset}
              disabled={busy}
            >
              Reset
            </button>
          </div>

          {message ? (
            <p className="notice" role="status">
              {message}
            </p>
          ) : null}
        </form>
      </section>

      <section className="panel" aria-labelledby="schedule-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Delivery</p>
            <h2 id="schedule-heading">Scheduled delivery</h2>
          </div>
          <span className={deliveryActive ? "status status-on" : "status"}>
            {deliveryLabel}
          </span>
        </div>

        <p className="panel-copy">
          The scheduler runs as a separate server process. It reads these preferences, varies
          delivery times, retries failures, and removes expired subscriptions.
        </p>

        {deliveryStatus ? (
          <>
            <dl className="status-list">
              <div>
                <dt>Next delivery</dt>
                <dd>{formatMoment(deliveryStatus.nextDeliveryAt)}</dd>
              </div>
              <div>
                <dt>Last delivered</dt>
                <dd>{formatMoment(deliveryStatus.lastDeliveredAt)}</dd>
              </div>
              <div>
                <dt>Today</dt>
                <dd>
                  {deliveryStatus.dailyCount} of {deliveryStatus.preferences.maxPerDay}
                </dd>
              </div>
              <div>
                <dt>Timezone</dt>
                <dd>{deliveryStatus.preferences.timezone}</dd>
              </div>
            </dl>

            {deliveryStatus.recentOutcomes.length > 0 ? (
              <details className="source-details">
                <summary>Recent delivery outcomes</summary>
                <ul className="outcome-list">
                  {deliveryStatus.recentOutcomes
                    .slice(-5)
                    .reverse()
                    .map((outcome, index) => (
                      <li key={`${outcome.at}-${outcome.entryId}-${index}`}>
                        <span>{formatMoment(outcome.at)}</span> · {outcome.entryId} ·{" "}
                        {outcome.status}
                        {outcome.statusCode ? ` (${outcome.statusCode})` : ""}
                      </li>
                    ))}
                </ul>
              </details>
            ) : null}
          </>
        ) : (
          <p className="notice">
            {endpoint
              ? "The delivery service could not be reached. Check that the scheduler and server are running."
              : "Enable push notifications to create a server-side delivery schedule."}
          </p>
        )}
      </section>

      <section className="panel" aria-labelledby="data-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Privacy</p>
            <h2 id="data-heading">Local data</h2>
          </div>
          <span className="status">{historyCount} saved</span>
        </div>

        <p className="panel-copy">
          Notification history and preferences remain in this browser unless you explicitly enable
          push delivery. No personal reflection is sent to a model provider.
        </p>

        <div className="button-row">
          <button
            type="button"
            className="button button-ghost"
            onClick={() => {
              clearHistory();
              setHistoryCount(0);
              setMessage("Local notification history cleared.");
            }}
            disabled={historyCount === 0}
          >
            Clear local history
          </button>
        </div>
      </section>

      <section className="panel" aria-labelledby="about-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Provenance</p>
            <h2 id="about-heading">About the content</h2>
          </div>
        </div>
        <p className="panel-copy">
          MEMENTO distinguishes quotations, attributed paraphrases, historical notes, and
          AI-generated original writing. Sources appear with each entry. Historical claims are
          kept separate from interpretation.
        </p>
      </section>
    </div>
  );
}
