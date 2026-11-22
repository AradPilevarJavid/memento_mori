import type { DeliveryOutcome, DeliveryPreferences } from "./delivery";

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

async function readError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { error?: unknown }
    | null;
  return typeof payload?.error === "string"
    ? payload.error
    : "The delivery request failed.";
}

export async function fetchDeliveryStatus(
  endpoint: string,
): Promise<DeliveryStatus | null> {
  const response = await fetch(
    `/api/delivery/status?endpoint=${encodeURIComponent(endpoint)}`,
    { cache: "no-store" },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as DeliveryStatus;
}

export async function saveDeliveryPreferences(
  endpoint: string,
  preferences: DeliveryPreferences,
): Promise<DeliveryStatus> {
  const response = await fetch("/api/delivery/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint, preferences }),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as DeliveryStatus;
}

export async function setDeliveryPaused(
  endpoint: string,
  paused: boolean,
): Promise<DeliveryStatus> {
  const response = await fetch("/api/delivery/pause", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint, paused }),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as DeliveryStatus;
}
