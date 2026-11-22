import { sendNotification } from "web-push";

import { ENTRIES, getEntry, selectEntry } from "../content";
import type { DeliveryOutcome } from "../delivery";
import { notificationPayload } from "../notifications";
import { listQueue, saveQueue, type QueueJob } from "./queue";
import {
  dailyCountFor,
  isAllowedAt,
  localDateKey,
  nextAllowedAt,
  nextDeliveryAt,
  nextRetryAt,
} from "./schedule";
import {
  listSubscriptions,
  removeSubscription,
  updateSubscription,
  type StoredSubscription,
} from "./subscriptions";
import { configureWebPush, vapidConfigured } from "./vapid";

const MAX_RETRIES = 3;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_OUTCOMES = 25;

export interface SchedulerTickOptions {
  now?: Date;
  dryRun?: boolean;
  random?: () => number;
  log?: (message: string) => void;
  send?: (subscription: StoredSubscription, payload: string) => Promise<void>;
}

export interface SchedulerTickResult {
  processed: number;
  sent: number;
  failed: number;
  expired: number;
  scheduled: number;
}

export interface SchedulerOptions extends SchedulerTickOptions {
  once?: boolean;
  intervalMs?: number;
  signal?: AbortSignal;
}

function appendOutcome(
  outcomes: DeliveryOutcome[] | undefined,
  outcome: DeliveryOutcome,
): DeliveryOutcome[] {
  return [...(outcomes ?? []), outcome].slice(-MAX_OUTCOMES);
}

function historyFor(subscription: StoredSubscription): string[] {
  return subscription.outcomes
    .filter((outcome) => outcome.status === "sent")
    .map((outcome) => outcome.entryId);
}

function chooseEntry(
  subscription: StoredSubscription,
  random: () => number,
) {
  return selectEntry(historyFor(subscription), ENTRIES, random);
}

function scheduleNext(
  endpoint: string,
  subscription: StoredSubscription,
  now: Date,
  dailyCount: number,
  random: () => number,
  jobs: Map<string, QueueJob>,
  result: SchedulerTickResult,
  log: (message: string) => void,
): void {
  if (subscription.preferences.paused) {
    return;
  }

  const dueAt = nextDeliveryAt(
    now,
    subscription.preferences,
    subscription.lastDeliveredAt,
    dailyCount,
    random,
  );
  if (!dueAt) {
    return;
  }

  jobs.set(endpoint, {
    endpoint,
    dueAt: dueAt.toISOString(),
    createdAt: now.toISOString(),
    attempts: 0,
  });
  result.scheduled += 1;
  log(`scheduled ${endpoint} for ${dueAt.toISOString()}`);
}

export async function runSchedulerTick(
  options: SchedulerTickOptions = {},
): Promise<SchedulerTickResult> {
  const now = options.now ?? new Date();
  const random = options.random ?? Math.random;
  const log = options.log ?? (() => undefined);
  const send =
    options.send ??
    ((subscription: StoredSubscription, payload: string) =>
      sendNotification(subscription, payload));
  const result: SchedulerTickResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    expired: 0,
    scheduled: 0,
  };

  if (!options.dryRun && !options.send) {
    if (!vapidConfigured()) {
      throw new Error(
        "VAPID keys are not configured. Run `npm run setup:vapid` before starting the scheduler.",
      );
    }
    configureWebPush();
  }

  const subscriptions = await listSubscriptions();
  const queue = await listQueue();
  const byEndpoint = new Map(
    subscriptions.map((subscription) => [subscription.endpoint, subscription]),
  );
  const jobs = new Map(queue.map((job) => [job.endpoint, job]));

  for (const endpoint of [...jobs.keys()]) {
    if (!byEndpoint.has(endpoint)) {
      jobs.delete(endpoint);
    }
  }

  for (const subscription of subscriptions) {
    if (subscription.preferences.paused) {
      jobs.delete(subscription.endpoint);
      continue;
    }

    if (!jobs.has(subscription.endpoint)) {
      scheduleNext(
        subscription.endpoint,
        subscription,
        now,
        dailyCountFor(subscription, now),
        random,
        jobs,
        result,
        log,
      );
    }
  }

  const dueJobs = [...jobs.values()]
    .filter((job) => Date.parse(job.dueAt) <= now.getTime())
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt));

  for (const job of dueJobs) {
    const subscription = byEndpoint.get(job.endpoint);
    if (!subscription) {
      jobs.delete(job.endpoint);
      continue;
    }

    if (subscription.preferences.paused) {
      jobs.delete(job.endpoint);
      continue;
    }

    const dailyCount = dailyCountFor(subscription, now);
    if (dailyCount >= subscription.preferences.maxPerDay) {
      jobs.delete(job.endpoint);
      scheduleNext(
        job.endpoint,
        subscription,
        now,
        dailyCount,
        random,
        jobs,
        result,
        log,
      );
      continue;
    }

    if (!isAllowedAt(now, subscription.preferences)) {
      const allowed = nextAllowedAt(now, subscription.preferences);
      if (allowed) {
        jobs.set(job.endpoint, { ...job, dueAt: allowed.toISOString() });
      } else {
        jobs.delete(job.endpoint);
      }
      continue;
    }

    result.processed += 1;
    const entry = job.entryId
      ? getEntry(job.entryId) ?? chooseEntry(subscription, random)
      : chooseEntry(subscription, random);

    if (
      job.attempts === 0 &&
      subscription.lastEntryId === entry.id &&
      subscription.lastDeliveredAt &&
      now.getTime() - Date.parse(subscription.lastDeliveredAt) <
        DUPLICATE_WINDOW_MS
    ) {
      jobs.delete(job.endpoint);
      scheduleNext(
        job.endpoint,
        subscription,
        now,
        dailyCount,
        random,
        jobs,
        result,
        log,
      );
      continue;
    }

    if (options.dryRun) {
      log(`would send ${entry.id} to ${job.endpoint}`);
      jobs.delete(job.endpoint);
      continue;
    }

    try {
      await send(subscription, JSON.stringify(notificationPayload(entry)));

      const updated = await updateSubscription(job.endpoint, (current) => ({
        ...current,
        lastDeliveredAt: now.toISOString(),
        lastEntryId: entry.id,
        dailyDate: localDateKey(now, current.preferences.timezone),
        dailyCount: dailyCountFor(current, now) + 1,
        failures: 0,
        outcomes: appendOutcome(current.outcomes, {
          at: now.toISOString(),
          entryId: entry.id,
          status: "sent",
        }),
      }));

      if (!updated) {
        jobs.delete(job.endpoint);
        continue;
      }

      byEndpoint.set(updated.endpoint, updated);
      result.sent += 1;
      jobs.delete(job.endpoint);
      scheduleNext(
        updated.endpoint,
        updated,
        now,
        dailyCountFor(updated, now),
        random,
        jobs,
        result,
        log,
      );
      log(`sent ${entry.id} to ${job.endpoint}`);
    } catch (error) {
      const statusCode = (error as { statusCode?: number } | undefined)
        ?.statusCode;

      if (statusCode === 404 || statusCode === 410) {
        await removeSubscription(job.endpoint);
        byEndpoint.delete(job.endpoint);
        jobs.delete(job.endpoint);
        result.expired += 1;
        log(`removed expired subscription ${job.endpoint}`);
        continue;
      }

      const attempts = job.attempts + 1;
      const message = error instanceof Error ? error.message : String(error);
      const updated = await updateSubscription(job.endpoint, (current) => ({
        ...current,
        failures: (current.failures ?? 0) + 1,
        outcomes: appendOutcome(current.outcomes, {
          at: now.toISOString(),
          entryId: entry.id,
          status: "failed",
          statusCode,
          error: message,
        }),
      }));

      if (updated) {
        byEndpoint.set(updated.endpoint, updated);
      }
      result.failed += 1;
      const retryable =
        statusCode === undefined ||
        statusCode >= 500 ||
        statusCode === 408 ||
        statusCode === 429;

      if (retryable && attempts < MAX_RETRIES) {
        const retryAt = nextRetryAt(now, attempts, random);
        jobs.set(job.endpoint, {
          ...job,
          attempts,
          entryId: entry.id,
          dueAt: retryAt.toISOString(),
          lastError: message,
        });
        log(`retry ${entry.id} for ${job.endpoint} at ${retryAt.toISOString()}`);
      } else {
        jobs.delete(job.endpoint);
        scheduleNext(
          job.endpoint,
          {
            ...(updated ?? subscription),
            lastDeliveredAt: now.toISOString(),
          },
          now,
          dailyCount,
          random,
          jobs,
          result,
          log,
        );
        log(`gave up on ${entry.id} for ${job.endpoint}: ${message}`);
      }
    }
  }

  if (!options.dryRun) {
    await saveQueue([...jobs.values()]);
  }

  return result;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function runScheduler(options: SchedulerOptions = {}): Promise<void> {
  const configuredInterval = Number(
    process.env.MEMENTO_SCHEDULER_INTERVAL_MS ?? 20_000,
  );
  const intervalMs =
    options.intervalMs ??
    (Number.isFinite(configuredInterval) && configuredInterval >= 1_000
      ? configuredInterval
      : 20_000);
  const log = options.log ?? (() => undefined);

  if (!options.dryRun && !options.send && !vapidConfigured()) {
    throw new Error(
      "VAPID keys are not configured. Run `npm run setup:vapid` before starting the scheduler.",
    );
  }

  do {
    try {
      const result = await runSchedulerTick({ ...options, log });
      log(
        `tick processed=${result.processed} sent=${result.sent} failed=${result.failed} expired=${result.expired} scheduled=${result.scheduled}`,
      );
    } catch (error) {
      if (options.once) {
        throw error;
      }
      log(
        `tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (options.once) {
      return;
    }
    await sleep(intervalMs, options.signal);
  } while (!options.signal?.aborted);
}
