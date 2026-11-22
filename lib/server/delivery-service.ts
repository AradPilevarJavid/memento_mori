import type { DeliveryOutcome, DeliveryPreferences } from "../delivery";
import { enqueueJob, getJob, removeJob } from "./queue";
import { schedulerRunning } from "./lock";
import { dailyCountFor, nextDeliveryAt } from "./schedule";
import {
  getSubscription,
  updateSubscription,
  type StoredSubscription,
} from "./subscriptions";

export interface DeliveryStatus {
  configured: boolean;
  endpoint: string;
  preferences: DeliveryPreferences;
  nextDeliveryAt: string | null;
  lastDeliveredAt: string | null;
  lastEntryId: string | null;
  dailyCount: number;
  recentOutcomes: DeliveryOutcome[];
  schedulerRunning: boolean;
}

export async function getDeliveryStatus(
  endpoint: string,
  now = new Date(),
): Promise<DeliveryStatus | null> {
  const subscription = await getSubscription(endpoint);
  if (!subscription) {
    return null;
  }

  const [job, running] = await Promise.all([
    getJob(endpoint),
    schedulerRunning(),
  ]);

  return {
    configured: true,
    endpoint,
    preferences: subscription.preferences,
    nextDeliveryAt: job?.dueAt ?? null,
    lastDeliveredAt: subscription.lastDeliveredAt ?? null,
    lastEntryId: subscription.lastEntryId ?? null,
    dailyCount: dailyCountFor(subscription, now),
    recentOutcomes: subscription.outcomes.slice(-25),
    schedulerRunning: running,
  };
}

export async function updateDeliveryPreferences(
  endpoint: string,
  preferences: DeliveryPreferences,
): Promise<DeliveryStatus | null> {
  const updated = await updateSubscription(endpoint, (subscription) => ({
    ...subscription,
    preferences,
  }));
  if (!updated) {
    return null;
  }

  await rescheduleSubscription(updated);
  return getDeliveryStatus(endpoint);
}

export async function setDeliveryPaused(
  endpoint: string,
  paused: boolean,
): Promise<DeliveryStatus | null> {
  const updated = await updateSubscription(endpoint, (subscription) => ({
    ...subscription,
    preferences: { ...subscription.preferences, paused },
  }));
  if (!updated) {
    return null;
  }

  await rescheduleSubscription(updated);
  return getDeliveryStatus(endpoint);
}

export async function scheduleInitialDelivery(
  subscription: StoredSubscription,
  now = new Date(),
): Promise<void> {
  await rescheduleSubscription(subscription, now);
}

export async function rescheduleSubscription(
  subscription: StoredSubscription,
  now = new Date(),
): Promise<void> {
  await removeJob(subscription.endpoint);

  if (subscription.preferences.paused) {
    return;
  }

  const dueAt = nextDeliveryAt(
    now,
    subscription.preferences,
    subscription.lastDeliveredAt,
    dailyCountFor(subscription, now),
  );
  if (!dueAt) {
    return;
  }

  await enqueueJob({
    endpoint: subscription.endpoint,
    dueAt: dueAt.toISOString(),
    createdAt: now.toISOString(),
    attempts: 0,
  });
}
