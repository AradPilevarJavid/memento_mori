"use client";

import { useEffect, useState, type FormEvent } from "react";

import { NotificationOnboarding } from "@/components/NotificationOnboarding";
import {
  DEFAULT_PREFERENCES,
  clearHistory,
  loadHistory,
  loadPreferences,
  savePreferences,
  type Preferences,
} from "@/lib/storage";

export function SettingsView() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [historyCount, setHistoryCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setPreferences(loadPreferences());
    const refreshHistory = () => setHistoryCount(loadHistory().length);
    refreshHistory();
    window.addEventListener("memento:storage", refreshHistory);
    return () => window.removeEventListener("memento:storage", refreshHistory);
  }, []);

  const update = <Key extends keyof Preferences>(key: Key, value: Preferences[Key]) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    setMessage(null);
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const minMinutes = Math.max(1, preferences.minMinutes);
    const maxMinutes = Math.max(minMinutes, preferences.maxMinutes);
    const next = { ...preferences, minMinutes, maxMinutes };
    setPreferences(next);
    savePreferences(next);
    setMessage("Preferences saved in this browser.");
  };

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
          These boundaries are stored locally. Server-side scheduling will use them when delivery
          is introduced.
        </p>

        <form className="preferences-form" onSubmit={save}>
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

          <div className="button-row">
            <button type="submit" className="button">
              Save preferences
            </button>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                setPreferences(DEFAULT_PREFERENCES);
                savePreferences(DEFAULT_PREFERENCES);
                setMessage("Preferences reset.");
              }}
            >
              Reset
            </button>
          </div>

          {message ? <p className="notice">{message}</p> : null}
        </form>
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
