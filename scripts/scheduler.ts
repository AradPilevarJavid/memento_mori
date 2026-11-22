import { existsSync } from "node:fs";
import path from "node:path";

import { acquireSchedulerLock } from "../lib/server/lock";
import { runScheduler } from "../lib/server/scheduler";

for (const file of [".env.local", ".env"]) {
  const fullPath = path.join(process.cwd(), file);
  if (existsSync(fullPath)) {
    process.loadEnvFile(fullPath);
  }
}

async function main() {
  const once = process.argv.includes("--once");
  const dryRun = process.argv.includes("--dry-run");
  const controller = new AbortController();
  const release = dryRun
    ? async () => undefined
    : await acquireSchedulerLock();

  const stop = () => {
    controller.abort();
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    console.log(
      `[memento] scheduler started${once ? " (once)" : ""}${dryRun ? " (dry run)" : ""}`,
    );
    await runScheduler({
      once,
      dryRun,
      signal: controller.signal,
      log: (message) => console.log(`[memento] ${message}`),
    });
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    await release();
    console.log("[memento] scheduler stopped");
  }
}

main().catch((error) => {
  console.error(
    `[memento] scheduler failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
