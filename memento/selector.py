from __future__ import annotations

import random
from collections import Counter
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from .models import Entry


@dataclass(frozen=True)
class SelectorConfig:
    recent_window: int = 20
    category_window: int = 8
    format_window: int = 4


class Selector:
    """Chooses content while varying topic, format, and underlying themes."""

    def __init__(
        self,
        entries: Iterable[Entry],
        *,
        rng: random.Random | None = None,
        config: SelectorConfig | None = None,
    ) -> None:
        self.entries = list(entries)
        if not self.entries:
            raise ValueError("cannot select from an empty content library")
        self.rng = rng or random.Random()
        self.config = config or SelectorConfig()
        self.by_id = {entry.id: entry for entry in self.entries}

    def choose(self, history: Sequence[str] = ()) -> Entry:
        recent = self._recent_entries(history)
        recent_ids = {entry.id for entry in recent}

        pool = [entry for entry in self.entries if entry.id not in recent_ids]
        if not pool:
            last_id = recent[-1].id if recent else None
            pool = [entry for entry in self.entries if entry.id != last_id]
        if not pool:
            pool = list(self.entries)

        last = recent[-1] if recent else None

        category_window = recent[-self.config.category_window :]
        seen_categories = {entry.category for entry in category_window}
        fresh_categories = [
            entry for entry in pool if entry.category not in seen_categories
        ]
        if fresh_categories:
            pool = fresh_categories
        elif last is not None:
            different_category = [
                entry for entry in pool if entry.category != last.category
            ]
            if different_category:
                pool = different_category

        format_window = recent[-self.config.format_window :]
        seen_formats = {entry.format for entry in format_window}
        fresh_formats = [entry for entry in pool if entry.format not in seen_formats]
        if fresh_formats:
            pool = fresh_formats
        elif last is not None:
            different_format = [entry for entry in pool if entry.format != last.format]
            if different_format:
                pool = different_format

        category_counts = Counter(entry.category for entry in recent)
        format_counts = Counter(entry.format for entry in recent)
        theme_counts = Counter(theme for entry in recent for theme in entry.themes)

        weights: list[float] = []
        for entry in pool:
            weight = 1.0
            weight *= 1.0 / (1.0 + category_counts[entry.category])
            weight *= 1.0 / (1.0 + format_counts[entry.format])
            for theme in entry.themes:
                weight *= 1.0 / (1.0 + theme_counts[theme])
            weights.append(weight)

        return self.rng.choices(pool, weights=weights, k=1)[0]

    def _recent_entries(self, history: Sequence[str]) -> list[Entry]:
        recent_ids = list(history)[-self.config.recent_window :]
        return [
            self.by_id[entry_id] for entry_id in recent_ids if entry_id in self.by_id
        ]
