export interface DeliveryPreferences {
  activeStart: string;
  activeEnd: string;
  quietStart: string;
  quietEnd: string;
  minMinutes: number;
  maxMinutes: number;
  maxPerDay: number;
  timezone: string;
  paused: boolean;
}

export interface DeliveryOutcome {
  at: string;
  entryId: string;
  status: "sent" | "failed" | "expired" | "skipped";
  statusCode?: number;
  error?: string;
}

export const DEFAULT_DELIVERY_PREFERENCES: DeliveryPreferences = {
  activeStart: "08:00",
  activeEnd: "22:00",
  quietStart: "22:00",
  quietEnd: "08:00",
  minMinutes: 45,
  maxMinutes: 180,
  maxPerDay: 6,
  timezone: "UTC",
  paused: false,
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_INTERVAL_MINUTES = 7 * 24 * 60;

export function isValidTime(value: unknown): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function browserTimezone(): string {
  if (typeof window === "undefined") {
    return "UTC";
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function normalizeDeliveryPreferences(
  value: unknown,
  fallbackTimezone = "UTC",
): DeliveryPreferences {
  const input =
    value && typeof value === "object" ? (value as Partial<DeliveryPreferences>) : {};
  const timezone = isValidTimezone(input.timezone)
    ? input.timezone
    : isValidTimezone(fallbackTimezone)
      ? fallbackTimezone
      : "UTC";

  const minMinutes =
    typeof input.minMinutes === "number" &&
    Number.isFinite(input.minMinutes) &&
    input.minMinutes > 0
      ? Math.min(input.minMinutes, MAX_INTERVAL_MINUTES)
      : DEFAULT_DELIVERY_PREFERENCES.minMinutes;

  const maxMinutes =
    typeof input.maxMinutes === "number" &&
    Number.isFinite(input.maxMinutes) &&
    input.maxMinutes >= minMinutes
      ? Math.min(input.maxMinutes, MAX_INTERVAL_MINUTES)
      : Math.max(minMinutes, DEFAULT_DELIVERY_PREFERENCES.maxMinutes);

  const maxPerDay =
    typeof input.maxPerDay === "number" &&
    Number.isInteger(input.maxPerDay) &&
    input.maxPerDay >= 1
      ? Math.min(input.maxPerDay, 24)
      : DEFAULT_DELIVERY_PREFERENCES.maxPerDay;

  return {
    activeStart: isValidTime(input.activeStart)
      ? input.activeStart
      : DEFAULT_DELIVERY_PREFERENCES.activeStart,
    activeEnd: isValidTime(input.activeEnd)
      ? input.activeEnd
      : DEFAULT_DELIVERY_PREFERENCES.activeEnd,
    quietStart: isValidTime(input.quietStart)
      ? input.quietStart
      : DEFAULT_DELIVERY_PREFERENCES.quietStart,
    quietEnd: isValidTime(input.quietEnd)
      ? input.quietEnd
      : DEFAULT_DELIVERY_PREFERENCES.quietEnd,
    minMinutes,
    maxMinutes,
    maxPerDay,
    timezone,
    paused: typeof input.paused === "boolean" ? input.paused : false,
  };
}

export function validateDeliveryPreferences(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return "Preferences must be an object.";
  }

  const input = value as Partial<DeliveryPreferences>;
  for (const key of ["activeStart", "activeEnd", "quietStart", "quietEnd"] as const) {
    if (!isValidTime(input[key])) {
      return `${key} must use HH:MM format.`;
    }
  }

  if (
    typeof input.minMinutes !== "number" ||
    !Number.isFinite(input.minMinutes) ||
    input.minMinutes <= 0
  ) {
    return "minMinutes must be a positive number.";
  }

  if (
    typeof input.maxMinutes !== "number" ||
    !Number.isFinite(input.maxMinutes) ||
    input.maxMinutes < input.minMinutes
  ) {
    return "maxMinutes must be greater than or equal to minMinutes.";
  }

  if (
    input.minMinutes > MAX_INTERVAL_MINUTES ||
    input.maxMinutes > MAX_INTERVAL_MINUTES
  ) {
    return "Intervals must not exceed seven days.";
  }

  if (
    typeof input.maxPerDay !== "number" ||
    !Number.isInteger(input.maxPerDay) ||
    input.maxPerDay < 1 ||
    input.maxPerDay > 24
  ) {
    return "maxPerDay must be an integer between 1 and 24.";
  }

  if (!isValidTimezone(input.timezone)) {
    return "timezone must be a valid IANA timezone.";
  }

  if (typeof input.paused !== "boolean") {
    return "paused must be a boolean.";
  }

  return null;
}
