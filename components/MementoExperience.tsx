"use client";

import { useEffect, useState } from "react";

import { MementoCard } from "@/components/MementoCard";
import { selectEntry, type Entry } from "@/lib/content";
import {
  requestNotificationPermission,
  showEntryNotification,
} from "@/lib/notifications";
import { addHistory, loadHistory } from "@/lib/storage";

export function MementoExperience({ initialEntry }: { initialEntry: Entry }) {
  const [entry, setEntry] = useState(initialEntry);
  const [history, setHistory] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const records = loadHistory();
    const ids = records.map((record) => record.id);
    setHistory(ids);
    setMounted(true);
    if (ids.length > 0) {
      setEntry(selectEntry(ids));
    }
  }, []);

  const showAnother = () => {
    const current = loadHistory();
    const nextEntry = selectEntry(current.map((record) => record.id));
    setEntry(nextEntry);
    const records = addHistory(nextEntry.id, "web");
    setHistory(records.map((record) => record.id));
    setMessage(null);
  };

  const notify = async () => {
    setBusy(true);
    setMessage(null);

    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      setMessage(
        permission === "denied"
          ? "Notifications are blocked in your browser settings."
          : "Notification permission was not granted.",
      );
      setBusy(false);
      return;
    }

    const result = await showEntryNotification(entry);
    if (result === "shown") {
      const records = addHistory(entry.id, "notification");
      setHistory(records.map((record) => record.id));
      setMessage("Notification sent to this device.");
    } else {
      setMessage("This browser cannot display notifications.");
    }
    setBusy(false);
  };

  return (
    <div className="experience">
      <MementoCard
        entry={entry}
        actions={
          <>
            <button type="button" className="button" onClick={showAnother}>
              Another reflection
            </button>
            <button type="button" className="button button-ghost" onClick={notify} disabled={busy}>
              {busy ? "Sending..." : "Send as notification"}
            </button>
          </>
        }
      />

      <div className="experience-foot">
        <p>
          {mounted
            ? `${history.length} reflection${history.length === 1 ? "" : "s"} seen on this device.`
            : "Loading your reflections..."}
        </p>
        {message ? <p className="notice">{message}</p> : null}
      </div>
    </div>
  );
}
