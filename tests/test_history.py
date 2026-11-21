from __future__ import annotations

import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from memento.history import History, HistoryError, default_history_path


class HistoryTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.path = Path(self.temporary_directory.name) / "nested" / "history.json"
        self.history = History(self.path)

    def test_empty_history(self):
        self.assertEqual(self.history.load(), [])
        self.assertEqual(self.history.recent_ids(10), [])

    def test_add_and_load_records(self):
        moment = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
        self.history.add("first-entry", channel="desktop", at=moment)
        self.history.add("second-entry", channel="stdout", at=moment)
        records = self.history.load()
        self.assertEqual(
            [record.id for record in records], ["first-entry", "second-entry"]
        )
        self.assertEqual(records[0].channel, "desktop")
        self.assertEqual(self.history.recent_ids(1), ["second-entry"])

    def test_clear_removes_history(self):
        self.history.add("first-entry")
        self.history.clear()
        self.assertFalse(self.path.exists())
        self.assertEqual(self.history.load(), [])

    def test_corrupt_history_raises(self):
        self.path.parent.mkdir(parents=True)
        self.path.write_text("{not json", encoding="utf-8")
        with self.assertRaises(HistoryError):
            self.history.load()

    def test_unexpected_history_format_raises(self):
        self.path.parent.mkdir(parents=True)
        self.path.write_text('{"version": 1}', encoding="utf-8")
        with self.assertRaises(HistoryError):
            self.history.load()

    def test_default_path_can_be_overridden(self):
        with patch.dict(os.environ, {"MEMENTO_HISTORY_PATH": str(self.path)}):
            self.assertEqual(default_history_path(), self.path)

    def test_default_path_uses_xdg_data_home(self):
        with patch.dict(
            os.environ, {"XDG_DATA_HOME": self.temporary_directory.name}, clear=False
        ):
            os.environ.pop("MEMENTO_HISTORY_PATH", None)
            self.assertEqual(
                default_history_path(),
                Path(self.temporary_directory.name) / "memento_mori" / "history.json",
            )


if __name__ == "__main__":
    unittest.main()
