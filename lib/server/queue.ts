import { readJsonFile, writeJsonFile } from "./data";

export interface QueueJob {
  endpoint: string;
  dueAt: string;
  createdAt: string;
  attempts: number;
  entryId?: string;
  lastError?: string;
}

interface QueueFile {
  version: number;
  jobs: QueueJob[];
}

const QUEUE_FILE = "delivery-queue.json";

function normalizeJob(value: unknown): QueueJob | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const job = value as Partial<QueueJob>;
  if (typeof job.endpoint !== "string" || job.endpoint.length === 0) {
    return null;
  }
  if (typeof job.dueAt !== "string" || Number.isNaN(Date.parse(job.dueAt))) {
    return null;
  }

  return {
    endpoint: job.endpoint,
    dueAt: job.dueAt,
    createdAt:
      typeof job.createdAt === "string" && !Number.isNaN(Date.parse(job.createdAt))
        ? job.createdAt
        : new Date().toISOString(),
    attempts:
      typeof job.attempts === "number" && Number.isInteger(job.attempts) && job.attempts >= 0
        ? job.attempts
        : 0,
    entryId: typeof job.entryId === "string" ? job.entryId : undefined,
    lastError: typeof job.lastError === "string" ? job.lastError : undefined,
  };
}

export async function listQueue(): Promise<QueueJob[]> {
  const parsed = await readJsonFile<Partial<QueueFile>>(QUEUE_FILE, {
    version: 1,
    jobs: [],
  });
  if (!parsed || !Array.isArray(parsed.jobs)) {
    return [];
  }

  const byEndpoint = new Map<string, QueueJob>();
  for (const item of parsed.jobs) {
    const job = normalizeJob(item);
    if (job) {
      byEndpoint.set(job.endpoint, job);
    }
  }

  return [...byEndpoint.values()].sort((left, right) =>
    left.dueAt.localeCompare(right.dueAt),
  );
}

export async function saveQueue(jobs: QueueJob[]): Promise<void> {
  const byEndpoint = new Map<string, QueueJob>();
  for (const job of jobs) {
    const normalized = normalizeJob(job);
    if (normalized) {
      byEndpoint.set(normalized.endpoint, normalized);
    }
  }

  const ordered = [...byEndpoint.values()].sort((left, right) =>
    left.dueAt.localeCompare(right.dueAt),
  );
  const payload: QueueFile = { version: 1, jobs: ordered };
  await writeJsonFile(QUEUE_FILE, payload);
}

export async function getJob(endpoint: string): Promise<QueueJob | null> {
  const jobs = await listQueue();
  return jobs.find((job) => job.endpoint === endpoint) ?? null;
}

export async function enqueueJob(job: QueueJob): Promise<void> {
  const jobs = await listQueue();
  const next = jobs.filter((item) => item.endpoint !== job.endpoint);
  next.push(job);
  await saveQueue(next);
}

export async function removeJob(endpoint: string): Promise<void> {
  const jobs = await listQueue();
  const next = jobs.filter((job) => job.endpoint !== endpoint);
  if (next.length !== jobs.length) {
    await saveQueue(next);
  }
}
