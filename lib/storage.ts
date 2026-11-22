import {
  DEFAULT_DELIVERY_PREFERENCES,
  browserTimezone,
  normalizeDeliveryPreferences,
  type DeliveryPreferences,
} from "./delivery";

export type HistorySource = "web" | "notification" | "push";

export interface HistoryRecord {
  id: string;
  at: string;
  source: HistorySource;
}

export type Preferences = DeliveryPreferences;

export const DEFAULT_PREFERENCES: Preferences = { ...DEFAULT_DELIVERY_PREFERENCES };

const HISTORY_KEY = "memento.history.v1";
const PREFERENCES_KEY = "memento.preferences.v1";
const MAX_HISTORY = 200;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!isBrowser()) {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("memento:storage"));
  } catch {
    // Storage may be unavailable in private browsing or when full.
  }
}

export function loadHistory(): HistoryRecord[] {
  const records = readJson<HistoryRecord[]>(HISTORY_KEY, []);
  if (!Array.isArray(records)) {
    return [];
  }
  return records.filter(
    (record) =>
      record &&
      typeof record.id === "string" &&
      typeof record.at === "string" &&
      (record.source === "web" || record.source === "notification" || record.source === "push"),
  );
}

export function addHistory(id: string, source: HistorySource = "web"): HistoryRecord[] {
  const records = loadHistory();
  records.push({ id, at: new Date().toISOString(), source });
  const trimmed = records.slice(-MAX_HISTORY);
  writeJson(HISTORY_KEY, trimmed);
  return trimmed;
}

export function clearHistory(): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.removeItem(HISTORY_KEY);
  window.dispatchEvent(new Event("memento:storage"));
}

export function loadPreferences(): Preferences {
  const stored = readJson<Partial<Preferences>>(PREFERENCES_KEY, {});
  return normalizeDeliveryPreferences(stored, browserTimezone());
}

export function savePreferences(preferences: Preferences): void {
  writeJson(PREFERENCES_KEY, preferences);
}

export function historyIds(limit = 20): string[] {
  return loadHistory()
    .slice(-limit)
    .map((record) => record.id);
}
