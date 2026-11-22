"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  ATTRIBUTION_META,
  CATEGORY_META,
  attributionSummary,
  getEntry,
} from "@/lib/content";
import {
  clearHistory,
  loadHistory,
  type HistoryRecord,
} from "@/lib/storage";

export function HistoryView() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const refresh = () => setRecords(loadHistory());
    refresh();
    setMounted(true);
    window.addEventListener("memento:storage", refresh);
    return () => window.removeEventListener("memento:storage", refresh);
  }, []);

  const items = [...records].reverse().flatMap((record) => {
    const entry = getEntry(record.id);
    return entry ? [{ record, entry }] : [];
  });

  if (!mounted) {
    return <p className="muted-copy">Loading history...</p>;
  }

  return (
    <div className="history">
      <div className="history-toolbar">
        <p className="result-count">
          {items.length} reflection{items.length === 1 ? "" : "s"} in local history
        </p>
        {items.length > 0 ? (
          <button
            type="button"
            className="button button-ghost button-small"
            onClick={() => {
              clearHistory();
              setRecords([]);
            }}
          >
            Clear history
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <p>No reflections have arrived yet.</p>
          <Link href="/" className="button">
            Open today&apos;s reflection
          </Link>
        </div>
      ) : (
        <ol className="history-list">
          {items.map(({ record, entry }, index) => (
            <li key={`${record.at}-${record.id}-${index}`} className="history-item">
              <div className="history-meta">
                <span className={`badge category-${entry.category}`}>
                  {CATEGORY_META[entry.category].label}
                </span>
                <span className={`badge attribution-${entry.attribution}`}>
                  {ATTRIBUTION_META[entry.attribution].label}
                </span>
                <time dateTime={record.at}>{formatDate(record.at)}</time>
              </div>
              <p className="history-text">{entry.text}</p>
              <p className="attribution-primary">{attributionSummary(entry)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
