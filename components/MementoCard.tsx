import type { ReactNode } from "react";

import {
  ATTRIBUTION_META,
  CATEGORY_META,
  FORMAT_META,
  attributionLines,
  type Entry,
} from "@/lib/content";

export function MementoCard({
  entry,
  actions,
  compact = false,
}: {
  entry: Entry;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <article className={compact ? "memento-card memento-card-compact" : "memento-card"}>
      <div className="card-meta">
        <span className={`badge category-${entry.category}`}>{CATEGORY_META[entry.category].label}</span>
        <span className="badge badge-format">{FORMAT_META[entry.format].label}</span>
        <span className={`badge attribution-${entry.attribution}`}>
          {ATTRIBUTION_META[entry.attribution].label}
        </span>
      </div>

      <p className="memento-text">{entry.text}</p>

      <div className="attribution-block">
        {attributionLines(entry).map((line, index) => (
          <p key={line} className={index === 0 ? "attribution-primary" : "attribution-detail"}>
            {line}
          </p>
        ))}
      </div>

      {actions ? <div className="card-actions">{actions}</div> : null}
    </article>
  );
}
