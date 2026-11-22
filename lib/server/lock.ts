import { promises as fs } from "node:fs";

import { dataDir, dataFile } from "./data";

const LOCK_FILE = "scheduler.lock";

interface LockFile {
  pid: number;
  startedAt: string;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function readLock(): Promise<LockFile | null> {
  try {
    const raw = await fs.readFile(dataFile(LOCK_FILE), "utf8");
    const parsed = JSON.parse(raw) as Partial<LockFile>;
    if (typeof parsed.pid !== "number" || !Number.isInteger(parsed.pid)) {
      return null;
    }
    return {
      pid: parsed.pid,
      startedAt:
        typeof parsed.startedAt === "string" ? parsed.startedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function schedulerRunning(): Promise<boolean> {
  const lock = await readLock();
  return lock ? isProcessAlive(lock.pid) : false;
}

export async function acquireSchedulerLock(): Promise<() => Promise<void>> {
  await fs.mkdir(dataDir(), { recursive: true });
  const existing = await readLock();
  if (existing && isProcessAlive(existing.pid)) {
    throw new Error(`A scheduler is already running with pid ${existing.pid}.`);
  }

  const lock: LockFile = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };
  await fs.writeFile(dataFile(LOCK_FILE), `${JSON.stringify(lock, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  return async () => {
    const current = await readLock();
    if (current?.pid === process.pid) {
      await fs.unlink(dataFile(LOCK_FILE)).catch(() => undefined);
    }
  };
}
