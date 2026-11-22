import {
  normalizeDeliveryPreferences,
  type DeliveryOutcome,
  type DeliveryPreferences,
} from "../delivery";
import { readJsonFile, writeJsonFile } from "./data";

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
  preferences?: Partial<DeliveryPreferences>;
}

export interface StoredSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime: number | null;
  createdAt: string;
  updatedAt: string;
  preferences: DeliveryPreferences;
  lastDeliveredAt?: string;
  lastEntryId?: string;
  dailyDate?: string;
  dailyCount?: number;
  failures?: number;
  outcomes: DeliveryOutcome[];
}

interface SubscriptionFile {
  version: number;
  subscriptions: unknown[];
}

const SUBSCRIPTIONS_FILE = "push-subscriptions.json";

export function isValidSubscription(value: unknown): value is PushSubscriptionPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const subscription = value as Partial<PushSubscriptionPayload>;
  return (
    typeof subscription.endpoint === "string" &&
    subscription.endpoint.startsWith("https://") &&
    Boolean(subscription.keys) &&
    typeof subscription.keys?.p256dh === "string" &&
    typeof subscription.keys?.auth === "string"
  );
}

function normalizeOutcome(value: unknown): DeliveryOutcome | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const outcome = value as Partial<DeliveryOutcome>;
  if (
    typeof outcome.at !== "string" ||
    typeof outcome.entryId !== "string" ||
    (outcome.status !== "sent" &&
      outcome.status !== "failed" &&
      outcome.status !== "expired" &&
      outcome.status !== "skipped")
  ) {
    return null;
  }

  return {
    at: outcome.at,
    entryId: outcome.entryId,
    status: outcome.status,
    statusCode:
      typeof outcome.statusCode === "number" ? outcome.statusCode : undefined,
    error: typeof outcome.error === "string" ? outcome.error : undefined,
  };
}

function normalizeSubscription(value: unknown): StoredSubscription | null {
  if (!isValidSubscription(value)) {
    return null;
  }

  const raw = value as Partial<StoredSubscription> & PushSubscriptionPayload;
  const createdAt =
    typeof raw.createdAt === "string" && !Number.isNaN(Date.parse(raw.createdAt))
      ? raw.createdAt
      : new Date().toISOString();
  const outcomes = Array.isArray(raw.outcomes)
    ? raw.outcomes
        .map(normalizeOutcome)
        .filter((outcome): outcome is DeliveryOutcome => outcome !== null)
    : [];

  return {
    endpoint: raw.endpoint,
    keys: {
      p256dh: raw.keys.p256dh,
      auth: raw.keys.auth,
    },
    expirationTime:
      typeof raw.expirationTime === "number" ? raw.expirationTime : null,
    createdAt,
    updatedAt:
      typeof raw.updatedAt === "string" && !Number.isNaN(Date.parse(raw.updatedAt))
        ? raw.updatedAt
        : createdAt,
    preferences: normalizeDeliveryPreferences(raw.preferences),
    lastDeliveredAt:
      typeof raw.lastDeliveredAt === "string" ? raw.lastDeliveredAt : undefined,
    lastEntryId: typeof raw.lastEntryId === "string" ? raw.lastEntryId : undefined,
    dailyDate: typeof raw.dailyDate === "string" ? raw.dailyDate : undefined,
    dailyCount:
      typeof raw.dailyCount === "number" && Number.isInteger(raw.dailyCount)
        ? raw.dailyCount
        : undefined,
    failures:
      typeof raw.failures === "number" && Number.isInteger(raw.failures)
        ? raw.failures
        : undefined,
    outcomes,
  };
}

export async function listSubscriptions(): Promise<StoredSubscription[]> {
  const parsed = await readJsonFile<Partial<SubscriptionFile>>(SUBSCRIPTIONS_FILE, {
    version: 2,
    subscriptions: [],
  });
  if (!parsed || !Array.isArray(parsed.subscriptions)) {
    return [];
  }

  return parsed.subscriptions
    .map(normalizeSubscription)
    .filter(
      (subscription): subscription is StoredSubscription => subscription !== null,
    );
}

export async function getSubscription(
  endpoint: string,
): Promise<StoredSubscription | null> {
  const subscriptions = await listSubscriptions();
  return subscriptions.find((subscription) => subscription.endpoint === endpoint) ?? null;
}

export async function saveSubscription(
  subscription: PushSubscriptionPayload,
): Promise<StoredSubscription> {
  if (!isValidSubscription(subscription)) {
    throw new Error("Invalid push subscription.");
  }

  const subscriptions = await listSubscriptions();
  const existing = subscriptions.find(
    (item) => item.endpoint === subscription.endpoint,
  );
  const now = new Date().toISOString();
  const preferences = subscription.preferences
    ? normalizeDeliveryPreferences(
        subscription.preferences,
        existing?.preferences.timezone,
      )
    : existing?.preferences ?? normalizeDeliveryPreferences({});

  const stored: StoredSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    expirationTime: subscription.expirationTime ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    preferences,
    lastDeliveredAt: existing?.lastDeliveredAt,
    lastEntryId: existing?.lastEntryId,
    dailyDate: existing?.dailyDate,
    dailyCount: existing?.dailyCount,
    failures: existing?.failures,
    outcomes: existing?.outcomes ?? [],
  };

  const next = subscriptions.filter(
    (item) => item.endpoint !== subscription.endpoint,
  );
  next.push(stored);
  await writeSubscriptions(next);
  return stored;
}

export async function updateSubscription(
  endpoint: string,
  updater: (subscription: StoredSubscription) => StoredSubscription,
): Promise<StoredSubscription | null> {
  const subscriptions = await listSubscriptions();
  const index = subscriptions.findIndex(
    (subscription) => subscription.endpoint === endpoint,
  );
  if (index === -1) {
    return null;
  }

  const updated = updater(subscriptions[index]);
  subscriptions[index] = {
    ...updated,
    endpoint,
    updatedAt: new Date().toISOString(),
    preferences: normalizeDeliveryPreferences(
      updated.preferences,
      updated.preferences.timezone,
    ),
  };
  await writeSubscriptions(subscriptions);
  return subscriptions[index];
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const subscriptions = await listSubscriptions();
  const next = subscriptions.filter(
    (subscription) => subscription.endpoint !== endpoint,
  );
  if (next.length !== subscriptions.length) {
    await writeSubscriptions(next);
  }
}

async function writeSubscriptions(
  subscriptions: StoredSubscription[],
): Promise<void> {
  const payload: SubscriptionFile = { version: 2, subscriptions };
  await writeJsonFile(SUBSCRIPTIONS_FILE, payload);
}
