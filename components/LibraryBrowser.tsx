"use client";

import { useMemo, useState } from "react";

import {
  ATTRIBUTIONS,
  ATTRIBUTION_META,
  CATEGORIES,
  CATEGORY_META,
  ENTRIES,
  FORMATS,
  FORMAT_META,
  attributionLines,
  entrySearchText,
  type Attribution,
  type Category,
  type EntryFormat,
} from "@/lib/content";

type CategoryFilter = Category | "all";
type FormatFilter = EntryFormat | "all";
type AttributionFilter = Attribution | "all";

export function LibraryBrowser() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [format, setFormat] = useState<FormatFilter>("all");
  const [attribution, setAttribution] = useState<AttributionFilter>("all");

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return ENTRIES.filter((entry) => {
      if (category !== "all" && entry.category !== category) {
        return false;
      }
      if (format !== "all" && entry.format !== format) {
        return false;
      }
      if (attribution !== "all" && entry.attribution !== attribution) {
        return false;
      }
      if (normalizedQuery && !entrySearchText(entry).includes(normalizedQuery)) {
        return false;
      }
      return true;
    });
  }, [query, category, format, attribution]);

  const reset = () => {
    setQuery("");
    setCategory("all");
    setFormat("all");
    setAttribution("all");
  };

  return (
    <div className="library">
      <div className="filter-bar">
        <label className="field field-search">
          <span>Search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Seneca, mortality, empire..."
          />
        </label>

        <label className="field">
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value as CategoryFilter)}>
            <option value="all">All categories</option>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {CATEGORY_META[item].label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Format</span>
          <select value={format} onChange={(event) => setFormat(event.target.value as FormatFilter)}>
            <option value="all">All formats</option>
            {FORMATS.map((item) => (
              <option key={item} value={item}>
                {FORMAT_META[item].label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Attribution</span>
          <select
            value={attribution}
            onChange={(event) => setAttribution(event.target.value as AttributionFilter)}
          >
            <option value="all">All types</option>
            {ATTRIBUTIONS.map((item) => (
              <option key={item} value={item}>
                {ATTRIBUTION_META[item].label}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="button button-ghost button-small" onClick={reset}>
          Reset
        </button>
      </div>

      <p className="result-count">
        {filtered.length} of {ENTRIES.length} entries
      </p>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>No reflections match those filters.</p>
          <button type="button" className="button button-ghost" onClick={reset}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="library-grid">
          {filtered.map((entry) => {
            const lines = attributionLines(entry);
            return (
              <article key={entry.id} className="library-card">
                <div className="card-meta">
                  <span className={`badge category-${entry.category}`}>
                    {CATEGORY_META[entry.category].label}
                  </span>
                  <span className="badge badge-format">{FORMAT_META[entry.format].label}</span>
                  <span className={`badge attribution-${entry.attribution}`}>
                    {ATTRIBUTION_META[entry.attribution].label}
                  </span>
                </div>

                <p className="library-text">{entry.text}</p>
                <p className="attribution-primary">{lines[0]}</p>

                {lines.length > 1 ? (
                  <details className="source-details">
                    <summary>Source and notes</summary>
                    {lines.slice(1).map((line) => (
                      <p key={line} className="attribution-detail">
                        {line}
                      </p>
                    ))}
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
