from __future__ import annotations

import json
import os
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

MAX_RECORDS = 500


class HistoryError(RuntimeError):
    """Raised when delivery history cannot be read or written."""


def default_history_path() -> Path:
    configured = os.environ.get("MEMENTO_HISTORY_PATH")
    if configured:
        return Path(configured).expanduser()
    xdg_data_home = os.environ.get("XDG_DATA_HOME")
    base = (
        Path(xdg_data_home).expanduser()
        if xdg_data_home
        else Path.home() / ".local" / "share"
    )
    return base / "memento_mori" / "history.json"


@dataclass(frozen=True)
class SelectionRecord:
    id: str
    at: str
    channel: str

    @classmethod
    def from_dict(cls, data: dict) -> SelectionRecord:
        return cls(
            id=str(data["id"]),
            at=str(data["at"]),
            channel=str(data.get("channel", "unknown")),
        )

    def to_dict(self) -> dict[str, str]:
        return {"id": self.id, "at": self.at, "channel": self.channel}


class History:
    def __init__(self, path: Path | str | None = None) -> None:
        self.path = (
            Path(path).expanduser() if path is not None else default_history_path()
        )

    def load(self) -> list[SelectionRecord]:
        if not self.path.exists():
            return []
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise HistoryError(f"could not read history at {self.path}: {exc}") from exc

        if not isinstance(raw, dict) or not isinstance(raw.get("selections"), list):
            raise HistoryError(f"history at {self.path} has an unexpected format")

        records: list[SelectionRecord] = []
        for item in raw["selections"]:
            if not isinstance(item, dict) or "id" not in item:
                continue
            try:
                records.append(SelectionRecord.from_dict(item))
            except (KeyError, TypeError, ValueError):
                continue
        return records

    def save(self, records: Sequence[SelectionRecord]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": 1,
            "selections": [record.to_dict() for record in records[-MAX_RECORDS:]],
        }
        temporary = self.path.with_name(f".{self.path.name}.tmp")
        try:
            temporary.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
            os.replace(temporary, self.path)
        except OSError as exc:
            raise HistoryError(
                f"could not write history at {self.path}: {exc}"
            ) from exc

    def add(
        self, entry_id: str, *, channel: str = "desktop", at: datetime | None = None
    ) -> None:
        records = self.load()
        moment = at or datetime.now(timezone.utc)
        records.append(
            SelectionRecord(
                id=entry_id,
                at=moment.astimezone(timezone.utc).isoformat(timespec="seconds"),
                channel=channel,
            )
        )
        self.save(records)

    def recent_ids(self, limit: int) -> list[str]:
        return [record.id for record in self.load()[-limit:]]

    def clear(self) -> None:
        try:
            self.path.unlink(missing_ok=True)
        except OSError as exc:
            raise HistoryError(
                f"could not clear history at {self.path}: {exc}"
            ) from exc
