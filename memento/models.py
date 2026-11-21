from __future__ import annotations

from dataclasses import dataclass
from typing import Any

CATEGORIES = ("emperors", "power", "philosophy", "mortality", "humility")
FORMATS = ("statement", "question", "reflection", "paradox", "observation")
ATTRIBUTIONS = ("quotation", "paraphrase", "observation", "original")

CATEGORY_DESCRIPTIONS = {
    "emperors": "Roman rulers: their lives, decisions, victories, excesses, failures, deaths, and legacies.",
    "power": "Ambition, domination, military victory, political authority, glory, tyranny, succession, and the fragility of control.",
    "philosophy": "Stoicism and other schools that illuminate power, mortality, virtue, ego, and human nature.",
    "mortality": "The impermanence of status, wealth, reputation, empires, and life itself.",
    "humility": "The limits, contradictions, weaknesses, and self-deceptions shared by human beings.",
}

FORMAT_DESCRIPTIONS = {
    "statement": "A direct claim or observation.",
    "question": "A question that turns the reader inward.",
    "reflection": "A longer thought meant to be sat with.",
    "paradox": "A tension that does not resolve neatly.",
    "observation": "A grounded historical or human observation.",
}

ATTRIBUTION_DESCRIPTIONS = {
    "quotation": "A translated or verbatim quotation from a named source.",
    "paraphrase": "An attributed paraphrase of a source, not presented as a direct quotation.",
    "observation": "A historical observation written for MEMENTO and grounded in the cited source.",
    "original": "AI-generated original writing for MEMENTO. Not a historical quotation or attributed saying.",
}


class ContentError(ValueError):
    """Raised when the content library is malformed or inconsistent."""


@dataclass(frozen=True)
class Entry:
    id: str
    category: str
    format: str
    text: str
    attribution: str
    themes: tuple[str, ...] = ()
    intensity: int = 2
    author: str | None = None
    work: str | None = None
    source: str | None = None
    note: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Entry:
        required = ("id", "category", "format", "text", "attribution")
        missing = [key for key in required if not data.get(key)]
        if missing:
            raise ContentError(
                f"entry {data.get('id', '<unknown>')!r} is missing: {', '.join(missing)}"
            )

        themes = data.get("themes") or ()
        if not isinstance(themes, (list, tuple)) or not all(
            isinstance(theme, str) for theme in themes
        ):
            raise ContentError(f"entry {data['id']!r} has invalid themes")

        intensity = data.get("intensity", 2)
        if not isinstance(intensity, int) or isinstance(intensity, bool):
            raise ContentError(f"entry {data['id']!r} has invalid intensity")

        return cls(
            id=str(data["id"]),
            category=str(data["category"]),
            format=str(data["format"]),
            text=str(data["text"]),
            attribution=str(data["attribution"]),
            themes=tuple(themes),
            intensity=intensity,
            author=data.get("author"),
            work=data.get("work"),
            source=data.get("source"),
            note=data.get("note"),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "category": self.category,
            "format": self.format,
            "text": self.text,
            "attribution": self.attribution,
            "themes": list(self.themes),
            "intensity": self.intensity,
            "author": self.author,
            "work": self.work,
            "source": self.source,
            "note": self.note,
        }
