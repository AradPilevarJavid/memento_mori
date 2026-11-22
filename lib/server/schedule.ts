import type { DeliveryPreferences } from "../delivery";

const MINUTE_MS = 60_000;
const MAX_SCAN_MINUTES = 60 * 48;

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

export function localDateKey(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function localMinutes(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  return parts.hour * 60 + parts.minute;
}

export function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function isWithinWindow(minutes: number, start: string, end: string): boolean {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  if (startMinutes === endMinutes) {
    return true;
  }
  if (startMinutes < endMinutes) {
    return minutes >= startMinutes && minutes < endMinutes;
  }
  return minutes >= startMinutes || minutes < endMinutes;
}

export function isQuietAt(date: Date, preferences: DeliveryPreferences): boolean {
  const minutes = localMinutes(date, preferences.timezone);
  if (preferences.quietStart === preferences.quietEnd) {
    return false;
  }
  return isWithinWindow(minutes, preferences.quietStart, preferences.quietEnd);
}

export function isActiveAt(date: Date, preferences: DeliveryPreferences): boolean {
  const minutes = localMinutes(date, preferences.timezone);
  return isWithinWindow(minutes, preferences.activeStart, preferences.activeEnd);
}

export function isAllowedAt(date: Date, preferences: DeliveryPreferences): boolean {
  return isActiveAt(date, preferences) && !isQuietAt(date, preferences);
}

export function nextAllowedAt(
  date: Date,
  preferences: DeliveryPreferences,
): Date | null {
  let candidate = new Date(Math.ceil(date.getTime() / MINUTE_MS) * MINUTE_MS);
  for (let index = 0; index <= MAX_SCAN_MINUTES; index += 1) {
    if (isAllowedAt(candidate, preferences)) {
      return candidate;
    }
    candidate = new Date(candidate.getTime() + MINUTE_MS);
  }
  return null;
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = target;

  for (let index = 0; index < 3; index += 1) {
    const parts = zonedParts(new Date(guess), timeZone);
    const localAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const offset = localAsUtc - guess;
    const next = target - offset;
    if (next === guess) {
      break;
    }
    guess = next;
  }

  return new Date(guess);
}

function nextLocalDateKey(date: Date, timeZone: string): string {
  const parts = zonedParts(date, timeZone);
  const tomorrow = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return `${tomorrow.getUTCFullYear()}-${pad(tomorrow.getUTCMonth() + 1)}-${pad(
    tomorrow.getUTCDate(),
  )}`;
}

function randomIntervalMinutes(
  preferences: DeliveryPreferences,
  random: () => number,
): number {
  return (
    preferences.minMinutes +
    random() * Math.max(0, preferences.maxMinutes - preferences.minMinutes)
  );
}

function withWindowJitter(
  date: Date,
  preferences: DeliveryPreferences,
  random: () => number,
): Date | null {
  const jitterMinutes = Math.floor(random() * 16);
  const candidate = new Date(date.getTime() + jitterMinutes * MINUTE_MS);
  if (isAllowedAt(candidate, preferences)) {
    return candidate;
  }
  return nextAllowedAt(candidate, preferences);
}

export function nextDeliveryAt(
  now: Date,
  preferences: DeliveryPreferences,
  lastDeliveredAt: string | null | undefined,
  dailyCount: number,
  random: () => number = Math.random,
): Date | null {
  if (preferences.paused) {
    return null;
  }

  if (dailyCount >= preferences.maxPerDay) {
    const [year, month, day] = nextLocalDateKey(now, preferences.timezone)
      .split("-")
      .map(Number);
    const midnight = zonedTimeToUtc(
      year,
      month,
      day,
      0,
      0,
      preferences.timezone,
    );
    const base = nextAllowedAt(new Date(midnight.getTime() + MINUTE_MS), preferences);
    return base ? withWindowJitter(base, preferences, random) : null;
  }

  const interval = randomIntervalMinutes(preferences, random);
  const last = lastDeliveredAt ? Date.parse(lastDeliveredAt) : Number.NaN;
  const candidate = new Date(
    Number.isNaN(last)
      ? now.getTime() + interval * MINUTE_MS
      : Math.max(now.getTime(), last + interval * MINUTE_MS),
  );

  if (isAllowedAt(candidate, preferences)) {
    return candidate;
  }

  const allowed = nextAllowedAt(candidate, preferences);
  return allowed ? withWindowJitter(allowed, preferences, random) : null;
}

export function dailyCountFor(
  subscription: {
    dailyDate?: string;
    dailyCount?: number;
    preferences: DeliveryPreferences;
  },
  now: Date,
): number {
  const date = localDateKey(now, subscription.preferences.timezone);
  return subscription.dailyDate === date ? subscription.dailyCount ?? 0 : 0;
}

export function nextRetryAt(
  now: Date,
  attempts: number,
  random: () => number = Math.random,
): Date {
  const baseMinutes = Math.min(15, 2 ** Math.max(1, attempts));
  const jitterMinutes = random() * 2;
  return new Date(now.getTime() + (baseMinutes + jitterMinutes) * MINUTE_MS);
}
