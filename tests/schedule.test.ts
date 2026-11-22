import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_DELIVERY_PREFERENCES,
  normalizeDeliveryPreferences,
  validateDeliveryPreferences,
  type DeliveryPreferences,
} from "../lib/delivery";
import { enqueueJob, listQueue, removeJob } from "../lib/server/queue";
import { runSchedulerTick } from "../lib/server/scheduler";
import {
  dailyCountFor,
  isAllowedAt,
  localDateKey,
  nextAllowedAt,
  nextDeliveryAt,
  nextRetryAt,
} from "../lib/server/schedule";
import {
  getSubscription,
  saveSubscription,
} from "../lib/server/subscriptions";

function preferences(
  overrides: Partial<DeliveryPreferences> = {},
): DeliveryPreferences {
  return normalizeDeliveryPreferences(
    { ...DEFAULT_DELIVERY_PREFERENCES, timezone: "UTC", ...overrides },
    "UTC",
  );
}

async function withTempData(run: () => Promise<void>): Promise<void> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "memento-test-"));
  const previous = process.env.MEMENTO_DATA_DIR;
  process.env.MEMENTO_DATA_DIR = directory;

  try {
    await run();
  } finally {
    if (previous === undefined) {
      delete process.env.MEMENTO_DATA_DIR;
    } else {
      process.env.MEMENTO_DATA_DIR = previous;
    }
    await fs.rm(directory, { recursive: true, force: true });
  }
}

async function addSubscription(
  endpoint: string,
  overrides: Partial<DeliveryPreferences> = {},
) {
  return saveSubscription({
    endpoint,
    keys: { p256dh: "fake-key", auth: "fake-auth" },
    preferences: preferences({
      activeStart: "00:00",
      activeEnd: "00:00",
      quietStart: "00:00",
      quietEnd: "00:00",
      minMinutes: 1,
      maxMinutes: 2,
      ...overrides,
    }),
  });
}

test("normalizes invalid preferences", () => {
  const normalized = normalizeDeliveryPreferences(
    {
      activeStart: "99:00",
      quietEnd: "07:30",
      minMinutes: 0,
      maxMinutes: 10,
      maxPerDay: 100,
      timezone: "Not/AZone",
      paused: "yes",
    },
    "Europe/Rome",
  );

  assert.equal(normalized.activeStart, DEFAULT_DELIVERY_PREFERENCES.activeStart);
  assert.equal(normalized.quietEnd, "07:30");
  assert.equal(normalized.minMinutes, DEFAULT_DELIVERY_PREFERENCES.minMinutes);
  assert.equal(normalized.maxMinutes, DEFAULT_DELIVERY_PREFERENCES.maxMinutes);
  assert.equal(normalized.maxPerDay, 24);
  assert.equal(normalized.timezone, "Europe/Rome");
  assert.equal(normalized.paused, false);
});

test("validates preference input", () => {
  assert.equal(validateDeliveryPreferences(preferences()), null);
  assert.match(
    validateDeliveryPreferences({ ...preferences(), timezone: "Bad/Zone" }) ?? "",
    /timezone/,
  );
  assert.match(
    validateDeliveryPreferences({ ...preferences(), minMinutes: 200, maxMinutes: 100 }) ?? "",
    /maxMinutes/,
  );
});

test("respects active and quiet windows", () => {
  const defaults = preferences();
  assert.equal(isAllowedAt(new Date("2026-01-15T09:00:00Z"), defaults), true);
  assert.equal(isAllowedAt(new Date("2026-01-15T23:00:00Z"), defaults), false);
  assert.equal(
    isAllowedAt(
      new Date("2026-01-15T13:30:00Z"),
      preferences({ quietStart: "13:00", quietEnd: "14:00" }),
    ),
    false,
  );

  const overnight = preferences({
    activeStart: "22:00",
    activeEnd: "06:00",
    quietStart: "00:00",
    quietEnd: "00:00",
  });
  assert.equal(isAllowedAt(new Date("2026-01-15T23:00:00Z"), overnight), true);
  assert.equal(isAllowedAt(new Date("2026-01-15T12:00:00Z"), overnight), false);
});

test("finds the next allowed window", () => {
  const result = nextAllowedAt(
    new Date("2026-01-15T23:00:00Z"),
    preferences(),
  );
  assert.equal(result?.toISOString(), "2026-01-16T08:00:00.000Z");
});

test("varies delivery times inside the allowed window", () => {
  const result = nextDeliveryAt(
    new Date("2026-01-15T09:00:00Z"),
    preferences(),
    null,
    0,
    () => 0.5,
  );
  assert.equal(result?.toISOString(), "2026-01-15T10:52:30.000Z");
});

test("measures intervals from the last delivery", () => {
  const result = nextDeliveryAt(
    new Date("2026-01-15T09:10:00Z"),
    preferences(),
    "2026-01-15T09:00:00.000Z",
    1,
    () => 0.5,
  );
  assert.equal(result?.toISOString(), "2026-01-15T10:52:30.000Z");
});

test("moves a quiet-hour candidate to the next active window", () => {
  const result = nextDeliveryAt(
    new Date("2026-01-15T21:50:00Z"),
    preferences(),
    null,
    0,
    () => 0.5,
  );
  assert.equal(result?.toISOString(), "2026-01-16T08:08:00.000Z");
});

test("defers after reaching the daily limit", () => {
  const result = nextDeliveryAt(
    new Date("2026-01-15T10:00:00Z"),
    preferences(),
    "2026-01-15T09:00:00.000Z",
    DEFAULT_DELIVERY_PREFERENCES.maxPerDay,
    () => 0.5,
  );
  assert.equal(result?.toISOString(), "2026-01-16T08:08:00.000Z");
});

test("does not schedule while paused", () => {
  const result = nextDeliveryAt(
    new Date("2026-01-15T09:00:00Z"),
    preferences({ paused: true }),
    null,
    0,
  );
  assert.equal(result, null);
});

test("resets the daily count on a new local day", () => {
  const subscription = {
    dailyDate: localDateKey(new Date("2026-01-15T12:00:00Z"), "UTC"),
    dailyCount: 3,
    preferences: preferences(),
  };
  assert.equal(
    dailyCountFor(subscription, new Date("2026-01-15T20:00:00Z")),
    3,
  );
  assert.equal(
    dailyCountFor(subscription, new Date("2026-01-16T01:00:00Z")),
    0,
  );
});

test("backs off retries", () => {
  const result = nextRetryAt(
    new Date("2026-01-15T09:00:00Z"),
    1,
    () => 0.5,
  );
  assert.equal(result.toISOString(), "2026-01-15T09:03:00.000Z");
});

test("scheduler sends and records a due delivery", async () => {
  await withTempData(async () => {
    const now = new Date("2026-01-15T09:00:00Z");
    const endpoint = "https://example.test/push/success";
    await addSubscription(endpoint);
    await enqueueJob({
      endpoint,
      dueAt: now.toISOString(),
      createdAt: now.toISOString(),
      attempts: 0,
    });

    const result = await runSchedulerTick({
      now,
      random: () => 0.5,
      send: async () => undefined,
    });

    assert.equal(result.sent, 1);
    const updated = await getSubscription(endpoint);
    assert.equal(updated?.outcomes.at(-1)?.status, "sent");
    assert.ok(updated?.lastEntryId);

    const jobs = await listQueue();
    assert.equal(jobs.length, 1);
    assert.ok(Date.parse(jobs[0].dueAt) > now.getTime());
  });
});

test("scheduler removes expired subscriptions", async () => {
  await withTempData(async () => {
    const now = new Date("2026-01-15T09:00:00Z");
    const endpoint = "https://example.test/push/expired";
    await addSubscription(endpoint);
    await enqueueJob({
      endpoint,
      dueAt: now.toISOString(),
      createdAt: now.toISOString(),
      attempts: 0,
    });

    const result = await runSchedulerTick({
      now,
      random: () => 0.5,
      send: async () => {
        const error = new Error("gone");
        Object.assign(error, { statusCode: 410 });
        throw error;
      },
    });

    assert.equal(result.expired, 1);
    assert.equal(await getSubscription(endpoint), null);
    assert.equal((await listQueue()).length, 0);
  });
});

test("scheduler retries transient failures", async () => {
  await withTempData(async () => {
    const now = new Date("2026-01-15T09:00:00Z");
    const endpoint = "https://example.test/push/retry";
    await addSubscription(endpoint);
    await enqueueJob({
      endpoint,
      dueAt: now.toISOString(),
      createdAt: now.toISOString(),
      attempts: 0,
    });

    const result = await runSchedulerTick({
      now,
      random: () => 0.5,
      send: async () => {
        const error = new Error("unavailable");
        Object.assign(error, { statusCode: 503 });
        throw error;
      },
    });

    assert.equal(result.failed, 1);
    const jobs = await listQueue();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].attempts, 1);
    assert.ok(jobs[0].entryId);
    assert.ok(Date.parse(jobs[0].dueAt) > now.getTime());
  });
});

test("scheduler schedules a new entry after a permanent failure", async () => {
  await withTempData(async () => {
    const now = new Date("2026-01-15T09:00:00Z");
    const endpoint = "https://example.test/push/permanent";
    await addSubscription(endpoint);
    await enqueueJob({
      endpoint,
      dueAt: now.toISOString(),
      createdAt: now.toISOString(),
      attempts: 0,
    });

    const result = await runSchedulerTick({
      now,
      random: () => 0.5,
      send: async () => {
        const error = new Error("bad request");
        Object.assign(error, { statusCode: 405 });
        throw error;
      },
    });

    assert.equal(result.failed, 1);
    const jobs = await listQueue();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].attempts, 0);
    assert.equal(jobs[0].entryId, undefined);
    assert.ok(Date.parse(jobs[0].dueAt) > now.getTime());
  });
});

test("scheduler removes queued work for paused subscriptions", async () => {
  await withTempData(async () => {
    const now = new Date("2026-01-15T09:00:00Z");
    const endpoint = "https://example.test/push/paused";
    await addSubscription(endpoint, { paused: true });
    await enqueueJob({
      endpoint,
      dueAt: now.toISOString(),
      createdAt: now.toISOString(),
      attempts: 0,
    });

    const result = await runSchedulerTick({
      now,
      send: async () => {
        throw new Error("should not send");
      },
    });

    assert.equal(result.sent, 0);
    assert.equal((await listQueue()).length, 0);
  });
});

test("keeps one queue job per endpoint", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "memento-queue-"));
  const previous = process.env.MEMENTO_DATA_DIR;
  process.env.MEMENTO_DATA_DIR = directory;

  try {
    await enqueueJob({
      endpoint: "https://example.test/push/one",
      dueAt: "2026-01-15T09:00:00.000Z",
      createdAt: "2026-01-15T08:00:00.000Z",
      attempts: 0,
    });
    await enqueueJob({
      endpoint: "https://example.test/push/one",
      dueAt: "2026-01-15T10:00:00.000Z",
      createdAt: "2026-01-15T08:00:00.000Z",
      attempts: 0,
    });

    const jobs = await listQueue();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].dueAt, "2026-01-15T10:00:00.000Z");

    await removeJob("https://example.test/push/one");
    assert.equal((await listQueue()).length, 0);
  } finally {
    if (previous === undefined) {
      delete process.env.MEMENTO_DATA_DIR;
    } else {
      process.env.MEMENTO_DATA_DIR = previous;
    }
    await fs.rm(directory, { recursive: true, force: true });
  }
});
