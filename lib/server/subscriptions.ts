import { promises as fs } from "node:fs";
import path from "node:path";

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
}

export interface StoredSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime: number | null;
  createdAt: string;
}

interface SubscriptionFile {
  version: number;
  subscriptions: StoredSubscription[];
}

function dataFile(): string {
  const directory = process.env.MEMENTO_DATA_DIR ?? path.join(process.cwd(), ".data");
  return path.join(directory, "push-subscriptions.json");
}

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

export async function listSubscriptions(): Promise<StoredSubscription[]> {
  try {
    const raw = await fs.readFile(dataFile(), "utf8");
    const parsed = JSON.parse(raw) as SubscriptionFile;
    if (!parsed || !Array.isArray(parsed.subscriptions)) {
      return [];
    }
    return parsed.subscriptions.filter((subscription) => isValidSubscription(subscription));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    return [];
  }
}

export async function saveSubscription(
  subscription: PushSubscriptionPayload,
): Promise<StoredSubscription> {
  if (!isValidSubscription(subscription)) {
    throw new Error("Invalid push subscription.");
  }

  const stored: StoredSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    expirationTime: subscription.expirationTime ?? null,
    createdAt: new Date().toISOString(),
  };

  const subscriptions = await listSubscriptions();
  const next = subscriptions.filter((item) => item.endpoint !== stored.endpoint);
  next.push(stored);
  await writeSubscriptions(next);
  return stored;
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const subscriptions = await listSubscriptions();
  const next = subscriptions.filter((subscription) => subscription.endpoint !== endpoint);
  if (next.length !== subscriptions.length) {
    await writeSubscriptions(next);
  }
}

async function writeSubscriptions(subscriptions: StoredSubscription[]): Promise<void> {
  const file = dataFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  const payload: SubscriptionFile = { version: 1, subscriptions };
  await fs.writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.rename(temporary, file);
}
