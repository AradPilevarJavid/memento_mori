from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

from .models import (
    ATTRIBUTIONS,
    CATEGORIES,
    FORMATS,
    ContentError,
    Entry,
)

CONTENT_PATH = Path(__file__).with_name("content.json")
ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MIN_TEXT_LENGTH = 12
MAX_TEXT_LENGTH = 400


def load_entries(path: Path | str | None = None) -> list[Entry]:
    content_path = Path(path) if path is not None else CONTENT_PATH
    try:
        raw = json.loads(content_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ContentError(f"content file not found: {content_path}") from exc
    except json.JSONDecodeError as exc:
        raise ContentError(f"invalid JSON in {content_path}: {exc}") from exc

    if not isinstance(raw, dict) or not isinstance(raw.get("entries"), list):
        raise ContentError("content file must be an object with an 'entries' list")

    entries: list[Entry] = []
    for index, item in enumerate(raw["entries"]):
        if not isinstance(item, dict):
            raise ContentError(f"entry at index {index} must be an object")
        entries.append(Entry.from_dict(item))

    errors = validate_entries(entries)
    if errors:
        raise ContentError("\n".join(errors))
    return entries


def validate_entries(entries: list[Entry]) -> list[str]:
    errors: list[str] = []
    ids: set[str] = set()
    texts: dict[str, str] = {}

    for entry in entries:
        label = f"entry {entry.id!r}"

        if not ID_PATTERN.match(entry.id):
            errors.append(f"{label}: id must be lowercase words separated by hyphens")
        if entry.id in ids:
            errors.append(f"{label}: duplicate id")
        ids.add(entry.id)

        if entry.category not in CATEGORIES:
            errors.append(f"{label}: unknown category {entry.category!r}")
        if entry.format not in FORMATS:
            errors.append(f"{label}: unknown format {entry.format!r}")
        if entry.attribution not in ATTRIBUTIONS:
            errors.append(f"{label}: unknown attribution {entry.attribution!r}")

        if not MIN_TEXT_LENGTH <= len(entry.text) <= MAX_TEXT_LENGTH:
            errors.append(
                f"{label}: text must be between {MIN_TEXT_LENGTH} and {MAX_TEXT_LENGTH} characters"
            )
        normalized_text = " ".join(entry.text.lower().split())
        if normalized_text in texts:
            errors.append(f"{label}: duplicates the text of {texts[normalized_text]!r}")
        else:
            texts[normalized_text] = entry.id

        if not 1 <= entry.intensity <= 5:
            errors.append(f"{label}: intensity must be between 1 and 5")

        if not entry.themes:
            errors.append(f"{label}: at least one theme is required")
        if len(set(entry.themes)) != len(entry.themes):
            errors.append(f"{label}: themes must not repeat")
        for theme in entry.themes:
            if not ID_PATTERN.match(theme):
                errors.append(
                    f"{label}: theme {theme!r} must be lowercase words separated by hyphens"
                )

        if entry.attribution in {"quotation", "paraphrase"}:
            if not entry.author:
                errors.append(f"{label}: {entry.attribution}s require an author")
            if not entry.work:
                errors.append(f"{label}: {entry.attribution}s require a work")
            if not entry.source:
                errors.append(f"{label}: {entry.attribution}s require a source")
        elif entry.attribution == "observation":
            if not entry.source:
                errors.append(f"{label}: historical observations require a source")
            if entry.author:
                errors.append(
                    f"{label}: historical observations should not claim a named author"
                )
        elif entry.attribution == "original" and (
            entry.author or entry.work or entry.source
        ):
            errors.append(
                f"{label}: original writing must not claim an author, work, or source"
            )

    return errors


def content_stats(entries: list[Entry]) -> dict[str, Counter[str]]:
    return {
        "categories": Counter(entry.category for entry in entries),
        "formats": Counter(entry.format for entry in entries),
        "attributions": Counter(entry.attribution for entry in entries),
        "themes": Counter(theme for entry in entries for theme in entry.themes),
    }
